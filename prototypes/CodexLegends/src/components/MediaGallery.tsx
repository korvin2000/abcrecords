import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GalleryImage } from "@/types/character";
import { audio } from "@/lib/audioEngine";

interface Props {
  mainPortrait: string;
  images: GalleryImage[];
  accent: string;
}

const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23161230'/%3E%3C/svg%3E";

export function MediaGallery({ mainPortrait, images, accent }: Props) {
  const all: GalleryImage[] = [{ src: mainPortrait, caption: "Codex Portrait" }, ...images];
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % all.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + all.length) % all.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, all.length]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {all.map((img, i) => (
          <motion.button
            key={i}
            onClick={() => {
              audio.click();
              setOpen(i);
            }}
            onMouseEnter={() => audio.hover()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ scale: 1.03 }}
            className={`group relative overflow-hidden rounded-lg border border-gold-500/15 ${
              i === 0 ? "col-span-2 row-span-2 sm:col-span-2" : ""
            }`}
            style={{ aspectRatio: i === 0 ? "3 / 4" : "4 / 3" }}
          >
            <img
              src={img.src}
              alt={img.caption}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-90" />
            <div
              className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ boxShadow: `inset 0 0 0 1.5px ${accent}` }}
            />
            <span className="absolute bottom-2 left-2 right-2 text-left font-body text-xs italic text-parchment/85 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {img.caption}
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-ink-950/70 p-1 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" />
              </svg>
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-md"
            onClick={() => setOpen(null)}
          >
            <button
              className="absolute right-5 top-5 rounded-full border border-gold-500/30 p-2 text-gold-200 transition-colors hover:bg-gold-500/10"
              onClick={() => setOpen(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 p-2 text-parchment/70 transition-colors hover:bg-white/10 sm:left-8"
              onClick={(e) => {
                e.stopPropagation();
                audio.pageTurn();
                setOpen((o) => (o === null ? o : (o - 1 + all.length) % all.length));
              }}
              aria-label="Previous"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <motion.figure
              key={open}
              initial={{ opacity: 0, scale: 0.92, rotateY: -20 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-h-[82vh] max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={all[open].src}
                alt={all[open].caption}
                className="max-h-[78vh] w-auto rounded-xl border border-gold-500/30 object-contain shadow-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK;
                }}
              />
              <figcaption className="mt-3 text-center font-body text-sm italic text-parchment/75">
                {all[open].caption}
              </figcaption>
            </motion.figure>
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 p-2 text-parchment/70 transition-colors hover:bg-white/10 sm:right-8"
              onClick={(e) => {
                e.stopPropagation();
                audio.pageTurn();
                setOpen((o) => (o === null ? o : (o + 1) % all.length));
              }}
              aria-label="Next"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
