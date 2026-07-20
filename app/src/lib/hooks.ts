import { useCallback, useEffect, useState } from "react";
import type { IndexEntry } from "./types";
import { loadIndex, prefetchAll } from "./catalog";
import type { Lang } from "./languages";
import { audio } from "./audio";

/** Catalogue index load state. */
export type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; entries: IndexEntry[] };

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
 * Load the catalogue index (with a retry) and warm per-entry metadata in idle
 * time so cards can show ranking stars. Re-warms on language change — cached
 * tongues resolve instantly, so repeat passes are cheap.
 */
export function useCatalog(lang: Lang): {
  state: LoadState;
  retry: () => void;
  rankings: ReadonlyMap<string, number>;
} {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [rankings, setRankings] = useState<ReadonlyMap<string, number>>(new Map());

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    loadIndex()
      .then((entries) => setState({ kind: "ready", entries }))
      .catch(() => setState({ kind: "error" }));
  }, []);

  useEffect(retry, [retry]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    prefetchAll(state.entries, lang, (slug, data) => {
      const r = data?.metadata?.ranking;
      if (typeof r === "number") setRankings((prev) => new Map(prev).set(slug, r));
    });
  }, [state, lang]);

  return { state, retry, rankings };
}

/** #/slug ↔ open codex — deep-linkable, back-button friendly. */
function slugFromHash(): string | null {
  const m = /^#\/([\w-]+)$/.exec(window.location.hash);
  return m ? m[1] : null;
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
