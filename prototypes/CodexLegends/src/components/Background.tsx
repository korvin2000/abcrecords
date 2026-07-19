import { useEffect, useMemo, useRef } from "react";
import { ParticleField } from "@/lib/particles";

/** Fixed full-screen ambient layer: embers, runic halo, vignette, grain. */
export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const field = new ParticleField(canvasRef.current);
    fieldRef.current = field;
    field.start();
    return () => field.stop();
  }, []);

  // Runic marks evenly spaced around a great circle.
  const runes = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return { x: 50 + Math.cos(a) * 48, y: 50 + Math.sin(a) * 48, r: a };
      }),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_40%,rgba(5,4,12,0.85)_100%)]" />

      {/* rotating runic halo */}
      <svg
        className="absolute left-1/2 top-[-22%] h-[150vh] w-[150vh] -translate-x-1/2 anim-spin-slow opacity-[0.07]"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle cx="50" cy="50" r="49" fill="none" stroke="#e6c25b" strokeWidth="0.12" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="#e6c25b" strokeWidth="0.08" strokeDasharray="0.6 1.4" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#34d3b8" strokeWidth="0.06" />
        {runes.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${(p.r * 180) / Math.PI})`}>
            <rect x="-0.4" y="-1.4" width="0.8" height="2.8" fill="#e6c25b" />
          </g>
        ))}
      </svg>

      {/* counter-rotating inner ring */}
      <svg
        className="absolute left-1/2 top-[10%] h-[80vh] w-[80vh] -translate-x-1/2 anim-spin-rev opacity-[0.05]"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <polygon
          points="50,4 93,75 7,75"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="0.15"
        />
        <polygon
          points="50,96 93,25 7,25"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="0.15"
        />
      </svg>

      {/* particle embers */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* film grain */}
      <div className="bg-grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
    </div>
  );
}
