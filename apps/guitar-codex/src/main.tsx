import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { I18nProvider, openingLang, prepareI18n } from "./lib/i18n";
import { preloadFonts } from "./lib/fontPreload";
import { ImageViewerProvider } from "./lib/imageViewer";
import { AsciiTabViewerProvider } from "./lib/asciiTabViewer";
import { PdfViewerProvider } from "./lib/pdfViewer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { publishScrollbarWidth } from "./lib/scrollbar";
import App from "./App";

// The boundary sits under I18nProvider (its fallback speaks the reader's
// language) but *over* the three viewer providers: they mount their overlays as
// siblings of `children`, so a boundary around <App /> alone would not catch a
// throw from the image, ascii-tab or document viewer.
// The codex's control row needs the platform's scrollbar width (see the module).
publishScrollbarWidth();

// Before the dictionary, so the two requests travel together.
preloadFonts(openingLang());

// Only ru and en ship in this chunk; the reader's own dictionary is fetched
// first so the first paint is already in their language (the static HTML's
// "Кодекс открывается…" holds the page meanwhile). It never rejects — a failed
// load renders through the en → ru fallbacks.
//
// …nor may it hold the page for ever: a chunk request that stalls rather than
// fails would leave the reader on the loading line, so the wait is bounded and
// the dictionary simply takes effect when it does arrive.
await Promise.race([prepareI18n(), new Promise((resolve) => setTimeout(resolve, 4000))]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary label="root">
        <ImageViewerProvider>
          <AsciiTabViewerProvider>
            <PdfViewerProvider>
              <App />
            </PdfViewerProvider>
          </AsciiTabViewerProvider>
        </ImageViewerProvider>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);
