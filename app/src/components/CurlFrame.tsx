import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Lifted-Curl photo frame — a warm ivory "print" border with two
 * curled-corner shadows that lift the picture off the page, plus a gentle
 * scale-up on hover. It replaces the old flat double border on every article
 * and gallery image (the main-menu CharacterCard keeps its own 3D-tilt effect).
 *
 * The look lives entirely in CSS (`.fx-curl`, see index.css); this component
 * only supplies the markup it needs (`.fx-curl > .inner > <img>`). It is
 * deliberately layout-agnostic: wrap it in the same clickable
 * <figure>/<span> that already owns the caption and the image-viewer click,
 * so opening the viewer keeps working untouched.
 *
 * Built from <span>s rather than <div>s so it stays valid HTML inside the
 * <p> that react-markdown wraps around inline biography images.
 */
export function CurlFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx("fx-curl", className)}>
      <span className="inner">{children}</span>
    </span>
  );
}
