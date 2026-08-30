import { lazy } from "react";

/** The document dialog, split out of the main bundle with the pdf.js engine
 *  it pulls in behind it. See LazyPdfViewer. */
const importPdfModal = () =>
  import("./PdfModal").then(({ PdfModal }) => ({ default: PdfModal }));

let pending: ReturnType<typeof importPdfModal> | undefined;
const loadPdfModal = () => (pending ??= importPdfModal());

export const LazyPdfModal = lazy(loadPdfModal);
export const preloadPdfModal = () => void loadPdfModal();
