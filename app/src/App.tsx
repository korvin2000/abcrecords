import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LANG_CODES } from "@/lib/languages";
import { slugOf } from "@/lib/paths";
import { buildSearchDoc, searchEntries, type SearchFilters } from "@/lib/search";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { useAudioUnlock, useCatalog, useHashRoute } from "@/lib/hooks";
import { Background } from "@/components/Background";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { LanguageMenu } from "@/components/LanguageMenu";
import { SearchBar } from "@/components/SearchBar";
import { CharacterGrid } from "@/components/CharacterGrid";
import { LazyCodexModal } from "@/components/codex/LazyCodexModal";
import { SiteFooter } from "@/components/SiteFooter";

export default function App() {
  const { t, lang, setLang } = useI18n();
  useAudioUnlock();
  const { state, retry, rankings } = useCatalog(lang);
  const { selectedSlug, openEntry } = useHashRoute();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    types: new Set<string>(),
    countries: new Set<string>(),
  });
  const [sound, setSound] = useState(true);
  const [ambient, setAmbient] = useState(false);

  const entries = state.kind === "ready" ? state.entries : [];
  const docs = useMemo(() => entries.map(buildSearchDoc), [entries]);
  const bySlug = useMemo(() => new Map(docs.map((d) => [d.slug, d])), [docs]);

  // One shared index searches all tongues; entries available in the chosen
  // language lead, the rest follow after a divider (dimmed, flagged in the
  // grid). ← → page-turn order matches this visual order.
  const { filtered, nativeCount } = useMemo(() => {
    const found = searchEntries(docs, query, filters);
    const native = found.filter((d) => d.langs.includes(lang));
    const foreign = found.filter((d) => !d.langs.includes(lang));
    return { filtered: [...native, ...foreign], nativeCount: native.length };
  }, [docs, query, filters, lang]);

  // resonate with the search: chime on first match, low hum on none
  const prevHasResults = useRef(true);
  useEffect(() => {
    if (!query.trim()) {
      prevHasResults.current = true;
      return;
    }
    const has = filtered.length > 0;
    if (has && !prevHasResults.current) audio.found();
    else if (!has && prevHasResults.current) audio.error();
    prevHasResults.current = has;
  }, [filtered.length, query]);

  const facets = useMemo(() => {
    const types = new Set<string>();
    const countries = new Set<string>();
    for (const e of entries) {
      if (e.type) types.add(e.type);
      if (e.country) countries.add(e.country);
    }
    return { types: [...types].sort(), countries: [...countries].sort() };
  }, [entries]);

  const toggleFilter = useCallback((key: keyof SearchFilters, val: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(val)) next[key].delete(val);
      else next[key].add(val);
      return next;
    });
  }, []);

  // ← → leaf between entries while the codex is open (wraps around)
  const turnPage = useCallback(
    (dir: -1 | 1) => {
      if (!selectedSlug) return;
      const list = filtered.length ? filtered : docs;
      const i = list.findIndex((d) => d.slug === selectedSlug);
      if (i === -1 || list.length < 2) return;
      audio.pageTurn();
      openEntry(list[(i + dir + list.length) % list.length].slug);
    },
    [selectedSlug, filtered, docs, openEntry],
  );

  // links inside biographies: "/paco-de-lucia.bio.md" → open that codex
  const navigateByMdPath = useCallback(
    (mdPath: string) => {
      const slug = slugOf({ md: mdPath });
      if (bySlug.has(slug)) openEntry(slug);
    },
    [bySlug, openEntry],
  );

  const toggleSound = () => {
    audio.unlock();
    const next = !sound;
    setSound(next);
    audio.setEnabled(next);
    if (!next) setAmbient(false);
  };

  const toggleAmbient = () => {
    audio.unlock();
    const next = !ambient;
    setAmbient(next);
    audio.setAmbient(next);
  };

  const selectedDoc = selectedSlug ? (bySlug.get(selectedSlug) ?? null) : null;

  // Single owner of the body scroll lock — per-modal locking miscounts when
  // AnimatePresence overlaps an exiting and an entering codex during ← → turns.
  useEffect(() => {
    if (!selectedDoc) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDoc]);

  return (
    <div className="relative min-h-screen">
      <Background />

      {/* fixed top control bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gold-600/25 bg-paper-100/70 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="anim-floaty text-base text-gold-700" aria-hidden>
            ✦
          </span>
          <span className="font-display text-sm font-bold tracking-[0.25em] text-burgundy-700">{t("app.brand")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageMenu
            variant="header"
            value={lang}
            options={LANG_CODES}
            onSelect={setLang}
            title={t("lang.menu")}
            heading={t("lang.title")}
          />
          <CtrlButton active={ambient} onClick={toggleAmbient} title={ambient ? t("ambient.on") : t("ambient.off")}>
            <span className="text-sm" aria-hidden>
              {ambient ? "🎼" : "🎵"}
            </span>
          </CtrlButton>
          <CtrlButton active={sound} onClick={toggleSound} title={sound ? t("sound.on") : t("sound.off")}>
            <span className="text-sm" aria-hidden>
              {sound ? "🔊" : "🔇"}
            </span>
          </CtrlButton>
        </div>
      </header>

      <main className="relative z-10 px-1 pb-16 pt-20 sm:px-2">
        <AnimatedTitle />

        {state.kind === "error" && (
          <div className="mx-auto mt-14 max-w-md px-6 text-center">
            <p className="font-display text-xl text-burgundy-600">{t("app.loadError")}</p>
            <button onClick={retry} className="btn-rpg mt-5">
              {t("app.retry")}
            </button>
          </div>
        )}

        {state.kind === "loading" && <GridSkeleton />}

        {state.kind === "ready" && (
          <>
            <SearchBar
              value={query}
              onChange={setQuery}
              filters={filters}
              onToggleType={(v) => toggleFilter("types", v)}
              onToggleCountry={(v) => toggleFilter("countries", v)}
              types={facets.types}
              countries={facets.countries}
              resultCount={filtered.length}
              totalCount={entries.length}
            />

            <div className="mt-10">
              <CharacterGrid docs={filtered} nativeCount={nativeCount} rankings={rankings} onSelect={openEntry} />
            </div>
          </>
        )}

      </main>

      <SiteFooter />

      <Suspense fallback={selectedDoc ? <CodexFallback /> : null}>
        <AnimatePresence>
          {selectedDoc && (
            <LazyCodexModal
              key={selectedDoc.slug}
              entry={selectedDoc.entry}
              slug={selectedDoc.slug}
              onClose={() => openEntry(null)}
              onTurn={turnPage}
              onNavigateEntry={navigateByMdPath}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

function CtrlButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-9 w-9 place-items-center rounded-full border transition-all ${
        active
          ? "border-gold-600/80 bg-gold-500/25 shadow-[0_0_12px_rgba(184,144,42,0.45)]"
          : "border-gold-600/40 hover:border-gold-600/70 hover:bg-gold-500/15"
      }`}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="skeleton aspect-[3/4.4] rounded-lg" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

function CodexFallback() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink-950/40 backdrop-blur-[2px]" aria-busy="true">
      <span className="h-12 w-12 animate-spin rounded-full border-2 border-gold-300/40 border-t-gold-500" />
    </div>
  );
}
