import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domAnimation } from "framer-motion";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { ImageViewerProvider } from "./lib/imageViewer";
import { AsciiTabViewerProvider } from "./lib/asciiTabViewer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";

// LazyMotion + `m` components keep the motion runtime slim (low-end friendly).
//
// The boundary sits under I18nProvider (its fallback speaks the reader's
// language) but *over* the two viewer providers: they mount their overlays as
// siblings of `children`, so a boundary around <App /> alone would not catch a
// throw from the image or ascii-tab viewer.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <I18nProvider>
        <ErrorBoundary label="root">
          <ImageViewerProvider>
            <AsciiTabViewerProvider>
              <App />
            </AsciiTabViewerProvider>
          </ImageViewerProvider>
        </ErrorBoundary>
      </I18nProvider>
    </LazyMotion>
  </StrictMode>,
);
