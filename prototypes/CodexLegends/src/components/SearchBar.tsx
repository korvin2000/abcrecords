import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { audio } from "@/lib/audioEngine";
import type { SearchFilters } from "@/lib/search";

interface Props {
  value: string;
  onChange: (v: string) => void;
  filters: SearchFilters;
  onToggleArchetype: (a: string) => void;
  onToggleElement: (e: string) => void;
  archetypes: string[];
  elements: string[];
  resultCount: number;
  totalCount: number;
}

function Chip({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        audio.click();
        onClick();
      }}
      onMouseEnter={() => audio.hover()}
      className={cn(
        "rounded-full border px-3 py-1 font-heading text-[0.7rem] uppercase tracking-wider transition-all duration-200",
        active
          ? "text-ink-950"
          : "border-gold-500/25 text-parchment/60 hover:border-gold-400/60 hover:text-gold-200"
      )}
      style={
        active
          ? { backgroundColor: accent, borderColor: accent, boxShadow: `0 0 14px ${accent}66` }
          : undefined
      }
    >
      {label}
    </button>
  );
}

export function SearchBar({
  value,
  onChange,
  filters,
  onToggleArchetype,
  onToggleElement,
  archetypes,
  elements,
  resultCount,
  totalCount,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6 }}
      className="mx-auto mt-10 w-full max-w-2xl"
    >
      <div className="group relative">
        {/* glow ring on focus */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-gold-500/0 via-gold-400/30 to-arcane-400/0 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-100" />
        <div className="relative flex items-center gap-3 rounded-2xl border border-gold-500/30 bg-ink-900/70 px-4 py-3 backdrop-blur-md transition-colors focus-within:border-gold-400/70">
          <svg
            className="h-5 w-5 shrink-0 text-gold-400/80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={value}
            autoFocus
            onChange={(e) => {
              onChange(e.target.value);
              audio.type();
            }}
            placeholder="Seek by name — e.g. Elara, Nightshade, Storm…"
            className="w-full bg-transparent font-body text-lg text-parchment placeholder:text-parchment/35 focus:outline-none"
          />
          {value && (
            <button
              onClick={() => {
                onChange("");
                audio.click();
              }}
              className="rounded-full p-1 text-parchment/50 transition-colors hover:text-gold-200"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* facets */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {archetypes.map((a) => (
            <Chip
              key={a}
              label={a}
              accent="#e6c25b"
              active={filters.archetypes.has(a)}
              onClick={() => onToggleArchetype(a)}
            />
          ))}
        </div>
        <span className="hidden text-gold-500/30 sm:inline">|</span>
        <div className="flex flex-wrap justify-center gap-1.5">
          {elements.map((e) => (
            <Chip
              key={e}
              label={e}
              accent="#34d3b8"
              active={filters.elements.has(e)}
              onClick={() => onToggleElement(e)}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 text-center font-heading text-xs uppercase tracking-[0.3em] text-parchment/45">
        {resultCount === totalCount
          ? `${totalCount} souls recorded`
          : `${resultCount} of ${totalCount} revealed`}
      </p>
    </motion.div>
  );
}
