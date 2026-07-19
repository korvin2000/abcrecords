import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import type { Character } from "@/types/character";

interface Props {
  character: Character;
  onNavigate: (id: string) => void;
  accent: string;
}

/** Markdown biography with theming + cross-document character links. */
export function BiographyView({ character, onNavigate, accent }: Props) {
  const components: Components = {
    h2: ({ children }) => (
      <h2 className="mt-2 mb-3 font-display text-2xl font-bold text-gold-300 text-glow-soft">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="mt-5 mb-2 flex items-center gap-2 font-heading text-lg font-semibold uppercase tracking-wide"
        style={{ color: accent }}
      >
        <span aria-hidden>✦</span>
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mb-3 font-body text-[1.05rem] leading-relaxed text-parchment/85">{children}</p>
    ),
    strong: ({ children }) => <strong className="font-semibold text-gold-200">{children}</strong>,
    em: ({ children }) => <em className="text-arcane-200/90">{children}</em>,
    ul: ({ children }) => <ul className="mb-4 space-y-1.5">{children}</ul>,
    li: ({ children }) => (
      <li className="flex gap-2.5 font-body text-parchment/80">
        <span style={{ color: accent }} className="mt-1 shrink-0 text-[0.6rem]">
          ◆
        </span>
        <span>{children}</span>
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className="my-4 rounded-r-lg border-l-2 bg-ink-900/50 py-2 pl-4 pr-3 italic"
        style={{ borderColor: accent }}
      >
        <div className="font-body text-lg leading-relaxed text-gold-100/90">{children}</div>
      </blockquote>
    ),
    hr: () => <div className="my-5 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />,
    a: ({ href, children }) => {
      if (href && href.startsWith("#")) {
        return (
          <button
            onClick={() => onNavigate(href.slice(1))}
            className="mx-0.5 inline-flex items-center gap-1 rounded border border-gold-500/40 bg-gold-500/10 px-1.5 py-0.5 font-heading text-[0.95em] font-semibold text-gold-200 transition-colors hover:bg-gold-500/25"
          >
            <span aria-hidden>➤</span>
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-arcane-300 underline decoration-dotted underline-offset-2 hover:text-arcane-200">
          {children}
        </a>
      );
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 rounded-lg border border-gold-500/15 bg-ink-900/40 p-3">
        <p className="font-body text-lg italic" style={{ color: accent }}>
          <span className="text-gold-500/70">“</span>
          {character.quote}
          <span className="text-gold-500/70">”</span>
        </p>
      </div>
      <div className="codex-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {character.biography}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
