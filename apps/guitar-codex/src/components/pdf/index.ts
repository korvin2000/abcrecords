/**
 * The document viewer's public surface — deliberately only the lazy entry
 * points. `PdfViewer` itself is *not* re-exported here: importing it from a
 * barrel would pull pdf.js back into whatever chunk imports the barrel, which
 * is exactly what LazyPdfViewer exists to prevent. Import it directly (inside
 * an already-lazy module) if you ever need it eagerly.
 */
export { LazyPdfViewer, preloadPdfViewer } from "./LazyPdfViewer";
export { LazyPdfModal, preloadPdfModal } from "./LazyPdfModal";
export type { PdfViewerProps } from "./PdfViewer";
