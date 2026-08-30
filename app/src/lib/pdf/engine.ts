import {
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
  type PDFDocumentLoadingTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * The pdf.js engine, wired for this application.
 *
 * Nothing here is imported by the catalogue itself: the only importer is the
 * lazily-loaded document viewer (components/pdf), so pdf.js and its ~1 MB
 * worker leave the main bundle entirely and are fetched the first time a
 * reader opens a PDF. Vite gives them a chunk of their own
 * (`manualChunks.pdf` in vite.config.ts) so that chunk caches independently
 * of application code.
 *
 * The worker is a real module worker: `?url` makes Vite emit
 * `pdf.worker.min.mjs` as a hashed asset and hands us its final URL, which is
 * what pdf.js needs — it constructs `new Worker(workerSrc, {type:"module"})`
 * itself. Building it any other way (a blob, a bare specifier) breaks under a
 * non-root `base`.
 */

GlobalWorkerOptions.workerSrc = workerUrl;

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
 */
const ASSET_BASE = `${import.meta.env.BASE_URL.replace(/\/*$/, "/")}pdfjs/`;

/**
 * Start loading a document. The returned task carries `.promise` for the
 * document and `.onProgress` for the bytes so far, and `.destroy()` cancels
 * an in-flight load as well as tearing down a finished one — so a reader who
 * closes the viewer mid-download stops paying for it.
 */
export function loadPdfDocument(url: string): PDFDocumentLoadingTask {
  return getDocument({
    url,
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    iccUrl: `${ASSET_BASE}iccs/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
    // Stream the file: the first pages paint while the rest is still arriving,
    // which is the whole difference between a 40-page scan opening at once and
    // opening in twelve seconds.
    disableStream: false,
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
