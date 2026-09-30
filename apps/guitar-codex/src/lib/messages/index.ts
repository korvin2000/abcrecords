import type { Lang } from "../languages";
import type { Message } from "./types";
import { ru, type MsgKey } from "./ru";
import { en } from "./en";

export type { Message, Plural } from "./types";
export type { MsgKey };

/** One complete UI dictionary (typed against the ru keys). */
export type Dict = Record<MsgKey, Message>;

/**
 * The dictionaries fetched on demand, one chunk each. `ru` (the reference key
 * set and last fallback) and `en` (the second fallback) stay in the entry
 * chunk so `t()` always has an answer; the other nine are ~135 KB of source
 * the reader never needs more than one of. Typed over every `Lang` but the two
 * static ones, so a language added without a dictionary is still a type error.
 */
const LOADERS: Record<Exclude<Lang, "ru" | "en">, () => Promise<Dict>> = {
  es: () => import("./es").then((m) => m.es),
  ja: () => import("./ja").then((m) => m.ja),
  de: () => import("./de").then((m) => m.de),
  fr: () => import("./fr").then((m) => m.fr),
  it: () => import("./it").then((m) => m.it),
  pt: () => import("./pt").then((m) => m.pt),
  uk: () => import("./uk").then((m) => m.uk),
  zh: () => import("./zh").then((m) => m.zh),
  ko: () => import("./ko").then((m) => m.ko),
};

/** The dictionaries in memory: the two fallbacks always, the rest once loaded. */
export const DICTS: Partial<Record<Lang, Dict>> & Record<"ru" | "en", Dict> = { ru, en };

const pending = new Map<Lang, Promise<boolean>>();

/**
 * Bring `lang`'s dictionary into `DICTS`. Resolves `true` once it is there,
 * `false` if it could not be loaded (offline, a stale deploy whose chunk is
 * gone) — never rejects, so a caller can always go on and let `t()`'s
 * `en → ru` chain answer. A failed load is forgotten, so the next call retries.
 */
export function loadDict(lang: Lang): Promise<boolean> {
  if (DICTS[lang]) return Promise.resolve(true);
  let request = pending.get(lang);
  if (!request) {
    const load = LOADERS[lang as keyof typeof LOADERS];
    request = load()
      .then((dict) => {
        DICTS[lang] = dict;
        return true;
      })
      .catch(() => false)
      .finally(() => pending.delete(lang));
    pending.set(lang, request);
  }
  return request;
}
