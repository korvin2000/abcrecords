import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LANG_CODES } from "@/lib/languages";
import { EMPTY_CATALOG } from "@/lib/catalog";
import { countryName } from "@/lib/metadata";
import { buildSearchIndex, searchEntries, type SearchFilters } from "@/lib/search";
import { audio } from "@/lib/audio";
import { typeLabel, useI18n } from "@/lib/i18n";
import { useAudioUnlock, useCatalog, useHashRoute } from "@/lib/hooks";
import { Background } from "@/components/Background";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { LanguageMenu } from "@/components/LanguageMenu";
import { SearchBar } from "@/components/SearchBar";
import { CharacterGrid } from "@/components/CharacterGrid";
import { LazyCodexModal } from "@/components/codex/LazyCodexModal";
import { SiteFooter } from "@/components/SiteFooter";

export default function App() {
  const { t, lang, locale, setLang } = useI18n();
  useAudioUnlock();
  const { state, retry } = useCatalog(lang);
  const { selectedSlug, openEntry } = useHashRoute();
  const [query, setQuery] = useState("");
  // Typing stays on the input's own frame; the grid re-ranks behind it.
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<SearchFilters>({
    types: new Set<string>(),
    countries: new Set<string>(),
  });
  const [sound, setSound] = useState(true);
  const [ambient, setAmbient] = useState(false);

  // Hidden entries stay out of the grid, the search and the facets, but keep
  // their route — so `listed` drives the browse UI and `bySlug` covers all.
  const catalog = state.kind === "ready" ? state.catalog : EMPTY_CATALOG;

  // Folding and lowercasing happen here — once per catalogue load and per UI
  // language — never per keystroke.
  const docs = useMemo(() => buildSearchIndex(catalog.listed, catalog.names), [catalog]);

  // One shared index searches all tongues; entries available in the chosen
  // language lead, the rest follow after a divider (dimmed, flagged in the
  // grid). Relevance order survives the split. ← → matches this visual order.
  const { results, nativeCount } = useMemo(() => {
    const found = searchEntries(docs, deferredQuery, filters);
    const native = found.filter((d) => d.record.langs.includes(lang));
    const foreign = found.filter((d) => !d.record.langs.includes(lang));
    return {
      results: [...native, ...foreign].map((d) => d.record),
      nativeCount: native.length,
    };
  }, [docs, deferredQuery, filters, lang]);

  // resonate with the search: chime on first match, low hum on none.
  // Keyed to the deferred query so the sound matches what is on screen.
  const prevHasResults = useRef(true);
  useEffect(() => {
    if (!deferredQuery.trim()) {
      prevHasResults.current = true;
      return;
    }
    const has = results.length > 0;
    if (has && !prevHasResults.current) audio.found();
    else if (!has && prevHasResults.current) audio.error();
    prevHasResults.current = has;
  }, [results.length, deferredQuery]);

  // Facet values are codes; readers see labels, so sort by the label in the
  // reader's locale — otherwise ISO codes order the country chips at random.
  const facets = useMemo(() => {
    const types = new Set<string>();
    const countries = new Set<string>();
    for (const { entry } of catalog.listed) {
      if (entry.type) types.add(entry.type);
      if (entry.country) countries.add(entry.country);
    }
    const collator = new Intl.Collator(locale);
    const by = (label: (v: string) => string) => (a: string, b: string) =>
      collator.compare(label(a), label(b));
    return {
      types: [...types].sort(by((ty) => typeLabel(t, ty))),
      countries: [...countries].sort(by((c) => countryName(c, locale) ?? c)),
    };
  }, [catalog, locale, t]);

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
      const list = results.length ? results : catalog.listed;
      const i = list.findIndex((r) => r.slug === selectedSlug);
      if (i === -1 || list.length < 2) return;
      audio.pageTurn();
      openEntry(list[(i + dir + list.length) % list.length].slug);
    },
    [selectedSlug, results, catalog, openEntry],
  );

  // Cross-links inside articles, already classified to a slug by BioArticle.
  // Hidden entries are linkable, so this resolves against every record.
  const openLinkedEntry = useCallback(
    (slug: string) => {
      if (catalog.bySlug.has(slug)) openEntry(slug);
    },
    [catalog, openEntry],
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

  const selectedRecord = selectedSlug ? (catalog.bySlug.get(selectedSlug) ?? null) : null;

  // Single owner of the body scroll lock — per-modal locking miscounts when
  // AnimatePresence overlaps an exiting and an entering codex during ← → turns.
  useEffect(() => {
    if (!selectedRecord) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedRecord]);

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
              resultCount={results.length}
              totalCount={catalog.listed.length}
            />

            {/* While a long query is still being ranked, dim rather than block */}
            <div
              className={clsx(
                "mt-10 transition-opacity duration-200",
                query !== deferredQuery && "opacity-60",
              )}
            >
              <CharacterGrid records={results} nativeCount={nativeCount} onSelect={openEntry} />
            </div>
          </>
        )}

      </main>

      <SiteFooter hasEntry={(slug) => catalog.bySlug.has(slug)} onOpenEntry={openEntry} />

      <Suspense fallback={selectedRecord ? <CodexFallback /> : null}>
        <AnimatePresence>
          {selectedRecord && (
            <LazyCodexModal
              key={selectedRecord.slug}
              record={selectedRecord}
              onClose={() => openEntry(null)}
              onTurn={turnPage}
              onNavigateEntry={openLinkedEntry}
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
