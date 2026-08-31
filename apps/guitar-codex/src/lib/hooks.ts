import { useCallback, useEffect, useState } from "react";
import { buildCatalog, loadIndex, loadNames, type Catalog } from "./catalog";
import { decodeSlug, SLUG_PATTERN } from "./entry";
import type { Lang } from "./languages";
import { audio } from "./audio";

/** Catalogue load state. */
export type CatalogState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; catalog: Catalog };

/**
 * Unlock the audio context on the first real user gesture (autoplay policy).
 * Per the HTML spec, mice activate on pointerdown while touch/pen activate on
 * pointerup — listen for both, plus keydown.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("pointerup", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("pointerup", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

/**
 * The catalogue index plus the localized name index for the reader's tongue,
 * assembled into the single object everything downstream reads. Both files
 * are cached module-side, so a language switch costs one small fetch — and
 * the catalogue already on screen stays there while it arrives.
 */
export function useCatalog(lang: Lang): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));

    Promise.all([loadIndex(), loadNames(lang)])
      .then(([entries, names]) => {
        if (alive) setState({ kind: "ready", catalog: buildCatalog(entries, names) });
      })
      .catch(() => {
        if (alive) setState({ kind: "error" });
      });

    return () => {
      alive = false;
    };
  }, [lang, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry };
}

/** #/slug ↔ open codex. Slugs are md basenames, so they may contain dots
 *  ("goya2.right") — hence SLUG_PATTERN rather than \w+. */
function slugFromHash(): string | null {
  const match = /^#\/([^?#]+)$/.exec(window.location.hash);
  if (!match) return null;
  const slug = decodeSlug(match[1]);
  return SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Deep-linkable codex selection via the URL hash (`#/slug`). Reading and
 * writing the hash keeps the back button working; `openEntry(null)` clears it.
 */
export function useHashRoute(): {
  selectedSlug: string | null;
  openEntry: (slug: string | null) => void;
} {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(slugFromHash);

  useEffect(() => {
    const onHash = () => setSelectedSlug(slugFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openEntry = useCallback((slug: string | null) => {
    const target = slug ? `#/${slug}` : "";
    if (window.location.hash !== target) {
      if (slug) window.location.hash = target;
      else history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    setSelectedSlug(slug);
  }, []);

  return { selectedSlug, openEntry };
}
