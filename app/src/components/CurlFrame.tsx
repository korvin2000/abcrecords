import clsx from "clsx";
import type { ReactNode } from "react";
import type { ImageFrame } from "@/lib/biomd/parse";

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
 *
 * `variant` selects an alternative frame requested by BioMD's `frame:` property
 * (spec 6.5). It is deliberately a static map, never a class name built from
 * content, and omitting it keeps the default Lifted Curl markup untouched.
 */
const FRAME_CLASS: Record<Exclude<ImageFrame, "curl">, string> = {
  none: "fx-curl--framed fx-curl--none",
  mat: "fx-curl--framed fx-curl--mat",
  black: "fx-curl--framed fx-curl--black",
  white: "fx-curl--framed fx-curl--white",
  red: "fx-curl--framed fx-curl--red",
  gold: "fx-curl--framed fx-curl--gold",
};

export function CurlFrame({
  className,
  variant,
  children,
}: {
  className?: string;
  variant?: ImageFrame;
  children: ReactNode;
}) {
  return (
    <span className={clsx("fx-curl", variant && variant !== "curl" && FRAME_CLASS[variant], className)}>
      <span className="inner">{children}</span>
    </span>
  );
}
