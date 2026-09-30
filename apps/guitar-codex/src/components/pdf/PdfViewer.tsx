import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { PDF } from "@/config";
import { usePagesManifest } from "@/lib/pdf/pages";
import { describeError, reportProblem } from "@/lib/diagnostics";
import { perfTier } from "@/lib/fx";
import { PdfImageView } from "./PdfImageView";
import { OpenFailed, Opening, basename } from "./readerShared";

/**
 * A continuous, themed PDF reader: toolbar on top, pages scrolling beneath it,
 * nothing else. It is the document counterpart of components/ImageViewer —
 * the same controls where the two overlap (zoom, fit, rotate, download), the
 * same gold-on-parchment chrome — and it is deliberately host-agnostic, so
 * the codex-styled dialog around it (PdfModal) and any future embedded use
 * share one implementation.
 *
 * **Two readers behind one door.** `PdfDocumentView` is pdf.js: exact,
 * zoomable to any size, selectable. `PdfImageView` reads the same issue as
 * pre-rendered page images when the archive holds them (lib/pdf/pages.ts) — no
 * engine, no sixty-megabyte download, and it opens on browsers pdf.js cannot
 * start on. This file only picks one and lets the reader change their mind:
 *
 *   - images, when the archive has them **and** the machine is graded `low`,
 *     or the file is larger than `PDF.liteOverBytes`;
 *   - images, when pdf.js — or its chunk — could not be had at all;
 *   - pdf.js otherwise, with the other reader one press away in the toolbar.
 *
 * The pdf.js reader is imported lazily *from here*, a second lazy boundary
 * inside the already-lazy viewer: a document read as images then never
 * downloads the engine (~145 KB gzipped) or starts its worker.
 */

export interface PdfViewerProps {
  /** Fully-resolved URL of the file. */
  src: string;
  /** Shown in the toolbar; the entry's name, not the file name. */
  title?: string;
  /** Suggested download filename. Defaults to the URL's basename. */
  download?: string;
  /** When given, the toolbar offers a close control. */
  onClose?: () => void;
  /** **Required in practice: this is where the viewer's size comes from.** It
   *  declares none of its own (see the note in the markup), so a host must give
   *  it a height — `flex-1 min-h-0` inside a flex column is the safest form,
   *  because flexbox cannot over-constrain the way `height` + `inset` can. */
  className?: string;
}

type Reader = "pdf" | "images";

type DocumentView = typeof import("./PdfDocumentView").PdfDocumentView;

/** The pdf.js reader's chunk. One request however many documents are opened;
 *  a failed one is forgotten, so the next document tries again. */
let pendingView: Promise<DocumentView> | undefined;
function loadDocumentView(): Promise<DocumentView> {
  return (pendingView ??= import("./PdfDocumentView").then(
    (module) => module.PdfDocumentView,
    (error: unknown) => {
      pendingView = undefined;
      throw error;
    },
  ));
}

export function PdfViewer({ src, title, download, onClose, className }: PdfViewerProps) {
  const manifest = usePagesManifest(src);
  // Decided once per document, when the manifest question is answered: the
  // machine's grade can still move a moment after load, and a reader must not
  // be moved from one reader to the other in the middle of a page.
  const [reader, setReader] = useState<{ src: string; kind: Reader } | null>(null);
  const [View, setView] = useState<DocumentView | null>(null);
  /** Why the pdf.js reader itself could not be loaded, when it could not. */
  const [engineFailure, setEngineFailure] = useState("");

  useEffect(() => {
    if (manifest === undefined) return;
    const images = manifest !== null && (perfTier() === "low" || manifest.bytes > PDF.liteOverBytes);
    setReader({ src, kind: images ? "images" : "pdf" });
  }, [src, manifest]);

  const kind = reader && reader.src === src ? reader.kind : null;

  // Fetch the engine as soon as it is likely to be wanted — alongside the
  // manifest question on any machine that is not graded `low` — and at the
  // latest when the pdf.js reader is chosen.
  const wanted = kind === "pdf" || (kind === null && perfTier() !== "low");
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    setEngineFailure("");
    loadDocumentView().then(
      // A component in state has to be wrapped, or React calls it as an updater.
      (loaded) => alive && setView(() => loaded),
      (error: unknown) => {
        if (!alive) return;
        const { name, message } = describeError(error);
        setEngineFailure(`${name}: ${message}`);
        reportProblem("pdf.engine", error);
      },
    );
    return () => {
      alive = false;
    };
  }, [wanted]);

  // pdf.js could not open it, and the archive has pictures of the same pages:
  // show those rather than an apology.
  const onBroken = useCallback(() => {
    if (manifest) setReader({ src, kind: "images" });
  }, [src, manifest]);

  useEffect(() => {
    if (engineFailure && kind === "pdf") onBroken();
  }, [engineFailure, kind, onBroken]);

  const downloadName = download ?? basename(src);

  return (
    // The viewer is always a toolbar over a scrolling pane; the host says how
    // large that column is, and **only** the host.
    //
    // This used to declare `h-full` as well, which is one owner too many: the
    // host (PdfModal) sizes it, and when a host does that by anchoring all four
    // sides, `height: 100%` and `bottom` are over-constrained. CSS resolves that
    // by discarding `bottom` — so the viewer was exactly its own top inset (11px)
    // taller than the frame it sits in, and its foot was drawn across the
    // parchment's inner border. It is sized from outside now, so the two can no
    // longer disagree.
    <div className={clsx("flex min-h-0 flex-col", className)}>
      {kind === "images" && manifest ? (
        <PdfImageView
          src={src}
          manifest={manifest}
          title={title}
          download={downloadName}
          onClose={onClose}
          onSwitch={() => {
            // A fresh attempt: the last failure must not send the reader
            // straight back here before the chunk has had its second chance.
            setEngineFailure("");
            setReader({ src, kind: "pdf" });
          }}
        />
      ) : kind === "pdf" && View ? (
        <View
          src={src}
          title={title}
          download={downloadName}
          onClose={onClose}
          onSwitch={manifest ? () => setReader({ src, kind: "images" }) : undefined}
          onBroken={onBroken}
        />
      ) : kind === "pdf" && engineFailure ? (
        // No toolbar was ever drawn, so the panel carries its own way out.
        <OpenFailed src={src} download={downloadName} reason={engineFailure} onClose={onClose} />
      ) : (
        <Opening />
      )}
    </div>
  );
}
