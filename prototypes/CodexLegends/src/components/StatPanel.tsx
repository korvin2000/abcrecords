import { motion } from "framer-motion";
import { powerRating } from "@/lib/procedural";
import type { Stat } from "@/types/character";

const ICON: Record<string, string> = {
  might: "⚔️",
  agility: "🏹",
  intellect: "📜",
  resolve: "🛡️",
  arcana: "✨",
  charisma: "👑",
};

export function StatPanel({ stats, accent }: { stats: Stat[]; accent: string }) {
  const power = powerRating(stats);
  const cx = 120;
  const cy = 120;
  const R = 84;
  const n = stats.length;
  const ang = (i: number) => ((-90 + (360 / n) * i) * Math.PI) / 180;
  const pt = (i: number, r: number) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const poly = (r: number) =>
    Array.from({ length: n }, (_, i) => pt(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");
  const dataPoly = stats
    .map((s, i) => pt(i, R * (Math.max(8, s.value) / 100)).map((v) => v.toFixed(1)).join(","))
    .join(" ");

  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {/* Radar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto aspect-square w-full max-w-[300px]"
      >
        <svg viewBox="0 0 240 240" className="h-full w-full">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={poly(R * f)}
              fill="none"
              stroke="#e6c25b"
              strokeWidth="0.6"
              opacity={0.18}
            />
          ))}
          {stats.map((_, i) => {
            const [x, y] = pt(i, R);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e6c25b" strokeWidth="0.5" opacity={0.22} />;
          })}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <polygon points={dataPoly} fill={accent} fillOpacity={0.18} stroke={accent} strokeWidth="2" />
            {stats.map((s, i) => {
              const [x, y] = pt(i, R * (Math.max(8, s.value) / 100));
              return <circle key={i} cx={x} cy={y} r="3.4" fill={accent} stroke="#05040c" strokeWidth="1" />;
            })}
          </motion.g>
          {stats.map((s, i) => {
            const [x, y] = pt(i, R + 16);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-heading"
                fontSize="9"
                fill="#ece3cc"
                opacity="0.8"
              >
                {s.label}
              </text>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-[0.6rem] uppercase tracking-[0.3em] text-parchment/50">
            Power
          </span>
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="font-display text-4xl font-black"
            style={{ color: accent, textShadow: `0 0 20px ${accent}99` }}
          >
            {power}
          </motion.span>
        </div>
      </motion.div>

      {/* Bars */}
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
        className="space-y-3"
      >
        {stats.map((s) => (
          <motion.li
            key={s.key}
            variants={{
              hidden: { opacity: 0, x: 18 },
              show: { opacity: 1, x: 0 },
            }}
          >
            <div className="mb-1 flex items-center justify-between font-heading text-sm">
              <span className="flex items-center gap-2 text-parchment/85">
                <span aria-hidden>{ICON[s.key] ?? "🔹"}</span>
                {s.label}
              </span>
              <span style={{ color: accent }} className="font-bold tabular-nums">
                {s.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-800/80 ring-1 ring-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.value}%` }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}88, ${accent})`,
                  boxShadow: `0 0 12px ${accent}aa`,
                }}
              />
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
