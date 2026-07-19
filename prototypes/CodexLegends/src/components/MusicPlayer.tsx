import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { audio } from "@/lib/audioEngine";
import type { ThemeSpec } from "@/types/character";

interface Props {
  theme: ThemeSpec;
  accent: string;
  enabled: boolean;
}

const BAR_COUNT = 30;

/**
 * Plays the character's procedurally-generated leitmotif (synthesised live
 * by the audio engine) and visualises its frequency spectrum in real time.
 */
export function MusicPlayer({ theme, accent, enabled }: Props) {
  const [playing, setPlaying] = useState(false);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let data: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;
    const loop = () => {
      const t = Date.now() / 360;
      // read the analyser fresh each frame (it is created lazily on unlock)
      const analyser = audio.themeAnalyser;
      if (analyser && (!data || data.length !== analyser.frequencyBinCount)) {
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }
      if (analyser && data && playing) {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BAR_COUNT; i++) {
          const el = barsRef.current[i];
          if (!el) continue;
          const idx = Math.floor((i / BAR_COUNT) * data.length);
          const v = data[idx] / 255;
          el.style.height = (4 + v * 44).toFixed(1) + "px";
          el.style.opacity = String(0.5 + v * 0.5);
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) {
          const el = barsRef.current[i];
          if (!el) continue;
          el.style.height = (3 + Math.sin(t + i * 0.6) * 1.8).toFixed(1) + "px";
          el.style.opacity = "0.3";
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // stop theme on unmount
  useEffect(() => () => audio.stopTheme(), []);

  // respect global mute
  useEffect(() => {
    if (!enabled && playing) {
      audio.stopTheme();
      setPlaying(false);
    }
  }, [enabled, playing]);

  const toggle = () => {
    audio.unlock();
    if (!enabled) return;
    if (playing) {
      audio.stopTheme();
      setPlaying(false);
    } else {
      audio.startTheme(theme);
      setPlaying(true);
    }
    audio.click();
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gold-500/20 bg-ink-900/60 p-3 backdrop-blur-sm">
      <button
        onClick={toggle}
        onMouseEnter={() => enabled && audio.hover()}
        disabled={!enabled}
        aria-label={playing ? "Pause leitmotif" : "Play leitmotif"}
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 0 18px ${accent}66` }}
      >
        {playing && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${accent}` }}
            animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#05040c">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#05040c">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-sm font-semibold text-gold-200">Leitmotif</span>
          <span className="font-heading text-[0.6rem] uppercase tracking-wider text-parchment/45">
            {theme.tempo} bpm · {theme.wave}
          </span>
        </div>
        <div className="mt-1.5 flex h-9 items-end gap-[2px]">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="w-full rounded-sm"
              style={{
                height: "4px",
                background: `linear-gradient(to top, ${accent}55, ${accent})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
