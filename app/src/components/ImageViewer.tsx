import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m } from "framer-motion";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import type { ViewerImage } from "@/lib/imageViewer";

/**
 * Full-screen image viewer in the manuscript theme. Zoom (buttons, wheel,
 * double-click), pan (drag / arrow keys when zoomed), rotate, fit ⇄ 1:1, and
 * download. Position is kept as a transform over the natural-size image, with
 * pan bounded so the picture can't be lost off-screen.
 */

interface Props {
  image: ViewerImage;
  onClose: () => void;
}

interface Transform {
  zoom: number; // multiplier over the fitted size (1 = fit)
  rotation: number; // degrees, multiples of 90
  x: number; // pan, px
  y: number;
}

const FIT: Transform = { zoom: 1, rotation: 0, x: 0, y: 0 };
const STEP = 1.4;

export function ImageViewer({ image, onClose }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tf, setTf] = useState<Transform>(FIT);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Track the image-area size for fit + pan bounds.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Own the body scroll lock while open (nests under the codex's own lock).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const fitScale = useMemo(() => {
    if (!natural || !size.w || !size.h) return 1;
    const turned = tf.rotation % 180 !== 0;
    const w = turned ? natural.h : natural.w;
    const h = turned ? natural.w : natural.h;
    // Fit must not upscale small images; this also makes 1:1 truthful.
    return Math.min(1, size.w / w, size.h / h) || 1;
  }, [natural, size, tf.rotation]);

  const displayScale = fitScale * tf.zoom;
  const maxZoom = Math.max(8, 1 / fitScale);
  const canPan = tf.zoom > 1.001;

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setTf((prev) => {
        const zoom = clamp(prev.zoom * factor, 1, maxZoom);
        const k = zoom / prev.zoom;
        const dx = cx == null ? 0 : cx - size.w / 2;
        const dy = cy == null ? 0 : cy - size.h / 2;
        const next = { ...prev, zoom, x: dx * (1 - k) + k * prev.x, y: dy * (1 - k) + k * prev.y };
        return bound(next, fitScale, natural, size, maxZoom);
      });
    },
    [fitScale, natural, size, maxZoom],
  );

  const fit = useCallback(() => setTf((prev) => ({ ...FIT, rotation: prev.rotation })), []);
  const actualSize = useCallback(
    () => setTf((prev) => bound({ ...prev, zoom: clamp(1 / fitScale, 1, maxZoom), x: 0, y: 0 }, fitScale, natural, size, maxZoom)),
    [fitScale, natural, size, maxZoom],
  );
  const rotate = useCallback((delta: number) => setTf((prev) => ({ ...prev, rotation: (prev.rotation + delta + 360) % 360, x: 0, y: 0 })), []);

  // Wheel zoom toward the cursor (needs a non-passive listener to preventDefault).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? STEP : 1 / STEP, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Keyboard controls — captured so they never reach the codex behind the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "Escape") return stop(), onClose();
      if (e.key === "+" || e.key === "=") return stop(), zoomAt(STEP);
      if (e.key === "-" || e.key === "_") return stop(), zoomAt(1 / STEP);
      if (e.key === "0") return stop(), fit();
      if (e.key === "r") return stop(), rotate(90);
      if (e.key.startsWith("Arrow")) {
        stop();
        if (!canPan) return;
        const d = 60;
        const nudge = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key] ?? [0, 0];
        setTf((prev) => bound({ ...prev, x: prev.x + nudge[0], y: prev.y + nudge[1] }, fitScale, natural, size, maxZoom));
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose, zoomAt, fit, rotate, canPan, fitScale, natural, size, maxZoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { px: e.clientX, py: e.clientY, ox: tf.x, oy: tf.y, moved: false };
    if (canPan) (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 3) d.moved = true;
    if (!canPan) return;
    setTf((prev) => bound({ ...prev, x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, fitScale, natural, size, maxZoom));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && e.target === areaRef.current) onClose(); // click on the backdrop
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const r = areaRef.current!.getBoundingClientRect();
    if (canPan) fit();
    else zoomAt(2.4, e.clientX - r.left, e.clientY - r.top);
  };

  return (
    <m.div
      className="fixed inset-0 z-[60] flex flex-col bg-ink-950/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || image.caption || "image"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("viewer.close")}
        title={t("viewer.close")}
        className="btn-rpg absolute right-4 top-4 z-20 !px-3"
      >
        ✕
      </button>

      <div
        ref={areaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        className={clsx(
          "relative flex flex-1 select-none items-center justify-center overflow-hidden touch-none",
          canPan ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        )}
      >
        {status !== "error" && (
          <img
            src={image.src}
            alt={image.alt ?? ""}
            draggable={false}
            onLoad={(e) => {
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
              setStatus("ready");
            }}
            onError={() => setStatus("error")}
            className="block max-w-none border border-gold-600/30 shadow-[0_10px_60px_rgba(0,0,0,0.6)]"
            style={{
              transform: `translate(${tf.x}px, ${tf.y}px) rotate(${tf.rotation}deg) scale(${displayScale})`,
              transformOrigin: "center",
              transition: drag.current ? "opacity 0.25s" : "transform 0.18s ease-out, opacity 0.25s",
              willChange: "transform",
              opacity: status === "ready" ? 1 : 0,
            }}
          />
        )}
        {status === "loading" && <Spinner />}
        {status === "error" && (
          <div className="px-6 text-center">
            <p className="font-display text-xl text-paper-200">{t("viewer.error")}</p>
            <DownloadLink src={image.src} name={image.download} className="btn-rpg mt-5 inline-block">
              {t("viewer.download")}
            </DownloadLink>
          </div>
        )}
      </div>

      {image.caption && (
        <p className="pointer-events-none px-6 pb-1 pt-2 text-center font-body text-sm italic text-paper-200/90">
          {image.caption}
        </p>
      )}

      {status === "ready" && (
        <div className="pointer-events-none flex justify-center pb-4 pt-1">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-gold-600/50 bg-paper-100/90 px-2 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur">
            <IconButton onClick={() => zoomAt(1 / STEP)} label={t("viewer.zoomOut")}>
              <Icon d="M5 12h14" />
            </IconButton>
            <span className="w-12 text-center font-heading text-xs tabular-nums text-ink-800">
              {Math.round(displayScale * 100)}%
            </span>
            <IconButton onClick={() => zoomAt(STEP)} label={t("viewer.zoomIn")}>
              <Icon d="M12 5v14M5 12h14" />
            </IconButton>
            <Sep />
            <IconButton onClick={fit} label={t("viewer.fit")}>
              <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </IconButton>
            <IconButton onClick={actualSize} label={t("viewer.actualSize")}>
              <span className="font-heading text-[0.62rem] font-bold leading-none">1:1</span>
            </IconButton>
            <Sep />
            <IconButton onClick={() => rotate(-90)} label={t("viewer.rotateLeft")}>
              <Icon d="M3 12a9 9 0 1 0 3-6.7M3 3v4h4" />
            </IconButton>
            <IconButton onClick={() => rotate(90)} label={t("viewer.rotateRight")}>
              <Icon d="M21 12a9 9 0 1 1-3-6.7M21 3v4h-4" />
            </IconButton>
            <Sep />
            <DownloadLink src={image.src} name={image.download} className={ICON_BTN} title={t("viewer.download")} aria-label={t("viewer.download")}>
              <Icon d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
            </DownloadLink>
          </div>
        </div>
      )}
    </m.div>
  );
}

const ICON_BTN =
  "grid h-9 w-9 place-items-center rounded-full border border-gold-600/40 text-gold-800 transition-colors hover:border-gold-600/80 hover:bg-gold-500/20";

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={ICON_BTN}>
      {children}
    </button>
  );
}

function DownloadLink({
  src,
  name,
  className,
  title,
  children,
  ...rest
}: {
  src: string;
  name?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
} & React.AriaAttributes) {
  return (
    <a href={src} download={name ?? ""} className={className} title={title} onClick={(e) => e.stopPropagation()} {...rest}>
      {children}
    </a>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-gold-600/30" aria-hidden />;
}

function Spinner() {
  return (
    <span
      className="h-12 w-12 animate-spin rounded-full border-2 border-gold-300/40 border-t-gold-500"
      role="status"
      aria-busy="true"
    />
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Constrain zoom and keep the picture from being panned off-screen. */
function bound(
  t: Transform,
  fitScale: number,
  natural: { w: number; h: number } | null,
  size: { w: number; h: number },
  maxZoom: number,
): Transform {
  const zoom = clamp(t.zoom, 1, maxZoom);
  if (!natural) return { ...t, zoom, x: 0, y: 0 };
  const ds = fitScale * zoom;
  const turned = t.rotation % 180 !== 0;
  const w = (turned ? natural.h : natural.w) * ds;
  const h = (turned ? natural.w : natural.h) * ds;
  const maxX = Math.max(0, (w - size.w) / 2);
  const maxY = Math.max(0, (h - size.h) / 2);
  return { ...t, zoom, x: clamp(t.x, -maxX, maxX), y: clamp(t.y, -maxY, maxY) };
}
