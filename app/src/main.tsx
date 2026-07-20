import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domAnimation } from "framer-motion";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { ImageViewerProvider } from "./lib/imageViewer";
import App from "./App";

// LazyMotion + `m` components keep the motion runtime slim (low-end friendly).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <I18nProvider>
        <ImageViewerProvider>
          <App />
        </ImageViewerProvider>
      </I18nProvider>
    </LazyMotion>
  </StrictMode>,
);
