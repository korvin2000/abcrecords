import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { LazyPdfModal, preloadPdfModal } from "@/components/pdf/LazyPdfModal";
import { isCrossOrigin } from "./paths";

/**
 * App-wide document viewer — the third of the three "open it here rather than
 * hand it to the browser" overlays, beside `imageViewer` and `asciiTabViewer`,
 * and built exactly like them.
 *
 * It exists because a PDF used to be the one archive file the app knew how to
 * read and still gave away: an index row that *is* a document opened in the
 * themed viewer, while the same file reached by a link inside an article — or
 * listed in a dossier's `documents[]` — opened in a new tab, i.e. in whatever
 * the platform's PDF plugin happens to be, on a phone often a download. One
 * viewer, one set of controls, one reading desk, whichever end the reader
 * came in from.
 *
 * Mounted above `App` (see main.tsx), so the overlay is a sibling of the whole
 * tree and stacks over an open codex at z 60 — the layer the image and
 * tablature viewers already share.
 */

export interface ViewerPdf {
  /** Fully resolved URL — the caller knows which base its path belongs to. */
  readonly src: string;
  /** Shown in the viewer's toolbar; the link's own text reads best. */
  readonly title?: string;
  /** Suggested download filename; defaults to the URL's basename. */
  readonly download?: string;
}

const PDF_RE = /\.pdf$/i;

/** True when the URL names a PDF file (query/hash ignored). */
export function isPdfUrl(url: string): boolean {
  return PDF_RE.test(url.split(/[?#]/, 1)[0]);
}

/**
 * …and true when this app may actually *open* it.
 *
 * The viewer reads the file itself (pdf.js fetches it), so a cross-origin
 * server has to allow that; the great majority do not, and a viewer that
 * reliably shows "the document could not be opened" is worse than the tab it
 * replaced. Somebody else's PDF therefore keeps opening as a link — the
 * archive's own, which is every relative target and every absolute one on this
 * origin, opens here.
 */
export function isViewablePdf(url: string): boolean {
  return isPdfUrl(url) && !isCrossOrigin(url);
}

type OpenPdf = (pdf: ViewerPdf) => void;
const PdfViewerContext = createContext<OpenPdf>(() => {});

/** `const open = usePdfViewer(); open({ src, title })`. */
export function usePdfViewer(): OpenPdf {
  return useContext(PdfViewerContext);
}

export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const [pdf, setPdf] = useState<ViewerPdf | null>(null);
  const open = useCallback<OpenPdf>((next) => {
    preloadPdfModal();
    setPdf(next);
  }, []);
  const close = useCallback(() => setPdf(null), []);

  return (
    <PdfViewerContext.Provider value={open}>
      {children}
      <Suspense fallback={null}>
        <AnimatePresence>
          {pdf && (
            <LazyPdfModal
              key={pdf.src}
              src={pdf.src}
              title={pdf.title ?? basename(pdf.src)}
              download={pdf.download}
              z={60}
              onClose={close}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </PdfViewerContext.Provider>
  );
}

function basename(url: string): string {
  return decodeURIComponent(url.split(/[?#]/, 1)[0].split("/").pop() || "document.pdf");
}
