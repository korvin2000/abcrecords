import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AppEvents, bus } from "../engine/EventBus";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    bus.emit(AppEvents.SEARCH_CHANGE, v);
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4">
      <motion.div
        className="relative"
        animate={{
          boxShadow: focus
            ? "0 0 30px rgba(212,175,55,0.4), inset 0 0 20px rgba(212,175,55,0.08)"
            : "0 0 10px rgba(212,175,55,0.15)",
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="ornate-border flex items-center gap-3 rounded-sm bg-gradient-to-b from-[#1a0f08] to-[#0a0604] px-4 py-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-4.3-4.3M10 18a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            placeholder="Search the codex by name, class, or homeland…"
            className="flex-1 border-none bg-transparent font-accent text-lg text-amber-100 placeholder:text-amber-100/30 focus:outline-none"
            spellCheck={false}
          />
          {value && (
            <button
              onClick={() => handleChange("")}
              className="text-amber-400/60 transition hover:text-amber-300"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <kbd className="hidden rounded border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 font-mono text-xs text-amber-300/70 sm:block">
            /
          </kbd>
        </div>
      </motion.div>
    </div>
  );
}
