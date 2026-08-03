import { useEffect, useState } from "react";
import type { EntryBundle } from "@/lib/types";
import { loadEntry, type CatalogRecord } from "@/lib/catalog";
import { pickContentLang, type Lang } from "@/lib/languages";

/**
 * Which language edition of an open entry is being read, and its content.
 *
 * Starts in the reader's tongue when the entry has it, else the entry's
 * original language, and follows the reader if they change the UI language.
 * Editions are cached per (entry, language) in `catalog.ts`, so flipping back
 * and forth is instant after the first read.
 */
export function useCodexEntry(
  record: CatalogRecord,
  uiLang: Lang,
): {
  contentLang: Lang;
  setContentLang: (lang: Lang) => void;
  bundle: EntryBundle | null;
} {
  const { entry, langs } = record;

  const [contentLang, setContentLang] = useState<Lang>(() => pickContentLang(langs, uiLang));
  useEffect(() => {
    setContentLang(pickContentLang(langs, uiLang));
  }, [langs, uiLang]);

  const [bundle, setBundle] = useState<EntryBundle | null>(null);
  useEffect(() => {
    let alive = true;
    setBundle(null);
    void loadEntry(entry, contentLang).then((loaded) => {
      if (alive) setBundle(loaded);
    });
    return () => {
      alive = false;
    };
  }, [entry, contentLang]);

  return { contentLang, setContentLang, bundle };
}
