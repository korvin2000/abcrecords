import type { QuoteMessage } from "@/lib/herald";

/**
 * A saying, set as a small epigraph: the words in italics between typographic
 * quotation marks, the author beneath on a hairline em-dash.
 *
 * `<blockquote>`/`<cite>` rather than a paragraph, because that is what this
 * is — and it keeps the block meaningful when the styling is stripped away.
 */
export function QuoteLine({ message }: { message: QuoteMessage }) {
  return (
    <blockquote className="herald-quote">
      <p className="herald-line italic">
        <span className="herald-quote-mark" aria-hidden>
          «
        </span>
        {message.text}
        <span className="herald-quote-mark" aria-hidden>
          »
        </span>
      </p>
      <cite className="herald-quote-author">— {message.author}</cite>
    </blockquote>
  );
}
