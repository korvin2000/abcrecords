import {
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
  setLayerDimensions,
  TextLayer,
  version,
  type PDFDocumentLoadingTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDF } from "@/config";

/**
 * The pdf.js engine, wired for this application.
 *
 * **This is the only module that imports `pdfjs-dist` values**, and it imports
 * the package's `legacy/` build on purpose. The default ("modern") build of
 * pdf.js 5 calls built-ins that shipped in 2025–26 — `Uint8Array.prototype.
 * toHex` (Chrome 140), `Map.prototype.getOrInsertComputed` (145),
 * `Math.sumPrecise` (147), `Promise.try` (128) — and calls them un-polyfilled,
 * in the worker as well as on the page. On any older engine a document either
 * never opens ("could not be opened"), opens with blank pages, or spins for
 * ever; that was every Android browser that is not an up-to-date Chrome (see
 * docs/performance-analysis.md §3.1). The legacy build carries its own
 * polyfills and costs ~60 KB more, in a chunk only a PDF reader ever fetches.
 * `build.target` cannot stand in for it: Vite lowers syntax, never APIs, and
 * the worker below is copied verbatim.
 *
 * Nothing here is imported by the catalogue itself: the only importers are the
 * lazily-loaded document viewer's modules (components/pdf), so pdf.js and its
 * ~1.3 MB worker leave the main bundle entirely and are fetched the first time
 * a reader opens a PDF. Vite gives them a chunk of their own
 * (`manualChunks.pdf` in vite.config.ts) so that chunk caches independently of
 * application code.
 *
 * The worker is a real module worker: `?url` makes Vite emit
 * `pdf.worker.min.mjs` as a hashed asset and hands us its final URL, which is
 * what pdf.js needs — it constructs `new Worker(workerSrc, {type:"module"})`
 * itself. Building it any other way (a blob, a bare specifier) breaks under a
 * non-root `base`. `scripts/verify-pdf-build.mjs` checks that the emitted file
 * is still the legacy one.
 */

GlobalWorkerOptions.workerSrc = workerUrl;

// Re-exported so the page component never needs a second import of the
// package — two importers is how a second copy of the engine gets bundled.
export { setLayerDimensions, TextLayer };
export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Where pdf.js's own runtime data lives: character maps for CJK encodings,
 * the fourteen standard PostScript fonts a PDF is allowed to reference
 * without embedding, colour profiles, and the WebAssembly image decoders
 * (JPEG 2000, JBIG2) that scanned material needs.
 *
 * They are files, not code — never bundled. `vite/pdfjs-assets.ts` copies
 * them out of node_modules into `pdfjs/` beside the app on build and serves
 * them from node_modules in development, so this resolves against the
 * application base and follows the app to /fable/ or wherever else it is
 * deployed. Each directory is fetched only if a document actually needs it.
 *
 * The engine's version is part of the path: `pdfjs/` is cached for a year
 * (vite/immutable-headers.ts), so the data an engine reads must be addressed
 * by the engine that reads it.
 */
const ASSET_BASE = `${import.meta.env.BASE_URL.replace(/\/*$/, "/")}pdfjs/${version}/`;

export interface LoadOptions {
  /**
   * Fetch only what is read. With this off pdf.js streams the file and then
   * keeps downloading until it holds all of it — instant later pages on a
   * desk, and sixty megabytes of worker memory on a phone that wanted page 1.
   * pdf.js only honours `disableAutoFetch` with streaming off as well, so the
   * two travel together. Needs range requests, which the archive serves.
   */
  frugal: boolean;
  /**
   * Ceiling on one decoded image, in bytes of bitmap (4 per pixel); larger
   * scans are downsampled as they are decoded. -1 leaves it to pdf.js.
   */
  imageBytes: number;
}

/**
 * Start loading a document. The returned task carries `.promise` for the
 * document and `.onProgress` for the bytes so far, and `.destroy()` cancels
 * an in-flight load as well as tearing down a finished one — so a reader who
 * closes the viewer mid-download stops paying for it.
 */
export function loadPdfDocument(url: string, { frugal, imageBytes }: LoadOptions): PDFDocumentLoadingTask {
  return getDocument({
    url,
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    iccUrl: `${ASSET_BASE}iccs/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
    // Streaming paints the first pages while the rest is still arriving —
    // the right trade wherever memory is not the constraint.
    disableStream: frugal,
    disableAutoFetch: frugal,
    // Four times pdf.js's default: a scanned page is several hundred KB, and
    // at 64 KB a page costs a volley of round trips on a phone's connection.
    rangeChunkSize: PDF.rangeChunkSize,
    canvasMaxAreaInBytes: imageBytes,
  });
}

/**
 * A cancelled page render is the normal outcome of scrolling away or zooming,
 * not a failure — it must never reach the error state.
 */
export function isCancellation(error: unknown): boolean {
  return (
    error instanceof RenderingCancelledException ||
    (error instanceof Error && error.name === "AbortException")
  );
}
