import { useCallback, useEffect, useState } from "react";
import type { EntryBundle } from "@/lib/types";
import { loadEntry, peekEntry, type CatalogRecord } from "@/lib/catalog";
import { pickContentLang, type Lang } from "@/lib/languages";

/**
 * Which language edition of an open entry is being read, and its content.
 *
 * Starts in the reader's tongue when the entry has it, else the entry's
 * original language, and follows the reader if they change the UI language.
 * Editions are cached per (entry, language) in `catalog.ts`, so flipping back
 * and forth is instant after the first read.
 *
 * Two things here exist for the sake of ← →, which changes `record` **without**
 * remounting the codex (App keeps one shell — see CodexShell):
 *
 * - The chosen edition is **derived during render**, not set from an effect.
 *   An effect would render one frame with the previous entry's language still
 *   selected, and that frame's load effect would fire a request for an edition
 *   nobody asked for — sometimes one that does not exist.
 * - A cached edition is read **synchronously** (`peekEntry`), so turning to an
 *   entry that has already been read paints its text in the same frame instead
 *   of flashing a skeleton.
 */
export function useCodexEntry(
  record: CatalogRecord,
  uiLang: Lang,
): {
  contentLang: Lang;
  setContentLang: (lang: Lang) => void;
  bundle: EntryBundle | null;
} {
  const { entry, slug, langs } = record;

  // The reader's own pick survives until the entry or the UI language moves;
  // `choice.for` is what makes "moved" a comparison rather than an effect.
  const scope = `${slug}::${uiLang}`;
  const [choice, setChoice] = useState(() => ({ for: scope, lang: pickContentLang(langs, uiLang) }));
  const contentLang = choice.for === scope ? choice.lang : pickContentLang(langs, uiLang);
  if (choice.for !== scope) setChoice({ for: scope, lang: contentLang });

  const setContentLang = useCallback((lang: Lang) => setChoice({ for: scope, lang }), [scope]);

  // Same story: a cache hit is state's *initial* value, never a second render.
  const key = `${scope}::${contentLang}`;
  const [loaded, setLoaded] = useState(() => ({ key, bundle: peekEntry(entry, contentLang) }));
  const bundle = loaded.key === key ? loaded.bundle : peekEntry(entry, contentLang);
  if (loaded.key !== key) setLoaded({ key, bundle });

  useEffect(() => {
    if (bundle) return; // already in hand — no request, no state churn
    let alive = true;
    void loadEntry(entry, contentLang).then((loadedBundle) => {
      if (alive) setLoaded({ key, bundle: loadedBundle });
    });
    return () => {
      alive = false;
    };
  }, [entry, contentLang, key, bundle]);

  return { contentLang, setContentLang, bundle };
}
