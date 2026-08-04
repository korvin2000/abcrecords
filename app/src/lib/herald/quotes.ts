import { resolveContentPath } from "../paths";
import type { Lang } from "../languages";
import type { QuoteMessage } from "./types";

/**
 * The book of sayings — `pages/quotes/quote-<lang>.json`, one fully localized
 * edition per UI language (see pages/quotes/README.md).
 *
 * Fetched once per language and cached like every other content file. A
 * missing or malformed file is normal, not an error: the herald simply has one
 * fewer thing to say. There is deliberately no cross-language fallback — a
 * Japanese reader is better served by no saying than by a Russian one.
 */

const NO_QUOTES: readonly QuoteMessage[] = [];

const cache = new Map<Lang, Promise<readonly QuoteMessage[]>>();

export function loadQuotes(lang: Lang): Promise<readonly QuoteMessage[]> {
  let request = cache.get(lang);
  if (!request) {
    request = fetch(resolveContentPath(`/quotes/quote-${lang}.json`))
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then(normalize)
      .catch(() => {
        cache.delete(lang); // a network blip must not stick for the session
        return NO_QUOTES;
      });
    cache.set(lang, request);
  }
  return request;
}

/** Keep the rows that carry both an author and a saying; drop the rest. */
function normalize(raw: unknown): readonly QuoteMessage[] {
  if (!Array.isArray(raw)) return NO_QUOTES;

  const quotes: QuoteMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const { author, quote } = row as Record<string, unknown>;
    const text = trimmed(quote);
    const by = trimmed(author);
    if (text && by) quotes.push({ kind: "quote", tone: "quote", author: by, text });
  }
  return quotes.length ? quotes : NO_QUOTES;
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
