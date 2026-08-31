import { lazy } from "react";

/**
 * pdf.js and its worker are around 1.6 MB between them — more than the rest of
 * the application put together — and most readers never open a document. So
 * the viewer, the engine and the worker are all behind this boundary and are
 * fetched on the first PDF, never before. `preloadPdfViewer` starts that fetch
 * a moment early (on hover, on intent), so the chunk is usually already there
 * by the time the modal mounts.
 */
const importPdfViewer = () =>
  import("./PdfViewer").then(({ PdfViewer }) => ({ default: PdfViewer }));

let pending: ReturnType<typeof importPdfViewer> | undefined;
const loadPdfViewer = () => (pending ??= importPdfViewer());

export const LazyPdfViewer = lazy(loadPdfViewer);
export const preloadPdfViewer = () => void loadPdfViewer();
