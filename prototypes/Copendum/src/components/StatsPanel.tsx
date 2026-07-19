import { motion } from "framer-motion";
import type { CharacterStats } from "../engine/Character";

const STAT_LABELS: { key: keyof CharacterStats; label: string; icon: string }[] = [
  { key: "strength", label: "Strength", icon: "⚔" },
  { key: "dexterity", label: "Dexterity", icon: "🏹" },
  { key: "constitution", label: "Constitution", icon: "🛡" },
  { key: "intelligence", label: "Intelligence", icon: "✦" },
  { key: "wisdom", label: "Wisdom", icon: "❂" },
  { key: "charisma", label: "Charisma", icon: "☥" },
];

export function StatsPanel({ stats }: { stats: CharacterStats }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {STAT_LABELS.map((s) => {
        const value = stats[s.key];
        const pct = (value / 20) * 100;
        return (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between font-display text-xs tracking-wider text-amber-900">
              <span className="flex items-center gap-1">
                <span className="text-sm">{s.icon}</span>
                <span>{s.label.toUpperCase()}</span>
              </span>
              <span className="font-bold text-crimson">{value}</span>
            </div>
            <div className="stat-bar h-2 rounded-sm">
              <motion.div
                className="stat-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
