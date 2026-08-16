import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { DOSSIER, EFFECTS, FEATURES, HERALD } from "@/config";
import { LANG_CODES, pickContentLang } from "@/lib/languages";
import { EMPTY_CATALOG, prefetchEntry } from "@/lib/catalog";
import { countryName } from "@/lib/metadata";
import { NO_FACTS, useFacts } from "@/lib/dossier";
import {
  buildSearchIndex,
  compile,
  searchEntries,
  withoutRefinements,
  EMPTY_CRITERIA,
  type SearchCriteria,
} from "@/lib/search";
import { audio } from "@/lib/audio";
import { setEffectsEnabled, useFx } from "@/lib/fx";
import { typeLabel, useI18n } from "@/lib/i18n";
import { useAudioUnlock, useCatalog, useHashRoute } from "@/lib/hooks";
import { Background } from "@/components/Background";
import { MusicalDrift } from "@/components/fx";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { HeraldBanner } from "@/components/herald";
import { LanguageMenu } from "@/components/LanguageMenu";
import { SearchBar } from "@/components/search";
import { CharacterGrid } from "@/components/CharacterGrid";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LazyCodexModal } from "@/components/codex/LazyCodexModal";
import { SiteFooter } from "@/components/SiteFooter";

export default function App() {
  const { t, lang, locale, setLang } = useI18n();
  useAudioUnlock();
  const { state, retry } = useCatalog(lang);
  const { selectedSlug, openEntry } = useHashRoute();
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  // Typing stays on the input's own frame; the grid re-ranks behind it.
  const deferredCriteria = useDeferredValue(criteria);
  const [sound, setSound] = useState(true);
  const [ambient, setAmbient] = useState(false);
  const fx = useFx();

  // Hidden entries stay out of the grid, the search and the facets, but keep
  // their route — so `listed` drives the browse UI and `bySlug` covers all.
  const catalog = state.kind === "ready" ? state.catalog : EMPTY_CATALOG;

  // Folding and lowercasing happen here — once per catalogue load and per UI
  // language — never per keystroke.
  const docs = useMemo(() => buildSearchIndex(catalog.listed, catalog.names), [catalog]);

  // Parsing years, folding name terms and collapsing "unset" to null happen
  // once per criteria change, not once per entry.
  const compiled = useMemo(() => compile(deferredCriteria), [deferredCriteria]);

  // Dossier metadata is read in the background: always for the herald's "on
  // this day" lookup, and on demand the moment a criterion needs a name or a
  // year. Both readers share one crawl (see lib/dossier).
  const heraldWantsFacts = FEATURES.herald && HERALD.anniversaries && DOSSIER.warmOnIdle;
  const facts = useFacts(catalog.listed, lang, heraldWantsFacts || compiled.needsDossier);

  // Handing the search a stable empty map unless it actually reads dossiers
  // keeps the streaming index from re-running the search on every batch.
  const searchFacts = compiled.needsDossier ? facts.bySlug : NO_FACTS;

  // One shared index searches all tongues; entries available in the chosen
  // language lead, the rest follow after a divider (dimmed, flagged in the
  // grid). Relevance order survives the split. ← → matches this visual order.
  const { results, nativeCount } = useMemo(() => {
    const found = searchEntries(docs, compiled, { lang, facts: searchFacts });
    const native = found.filter((d) => d.record.langs.includes(lang));
    const foreign = found.filter((d) => !d.record.langs.includes(lang));
    return {
      results: [...native, ...foreign].map((d) => d.record),
      nativeCount: native.length,
    };
  }, [docs, compiled, searchFacts, lang]);

  // resonate with the search: chime on first match, low hum on none.
  // Keyed to the deferred criteria so the sound matches what is on screen.
  const searching = compiled.tokens.length > 0 || compiled.needsDossier;
  const prevHasResults = useRef(true);
  useEffect(() => {
    if (!searching) {
      prevHasResults.current = true;
      return;
    }
    const has = results.length > 0;
    if (has && !prevHasResults.current) audio.found();
    else if (!has && prevHasResults.current) audio.error();
    prevHasResults.current = has;
  }, [results.length, searching]);

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

  const patchCriteria = useCallback((patch: Partial<SearchCriteria>) => {
    setCriteria((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetRefinements = useCallback(() => {
    setCriteria(withoutRefinements);
  }, []);

  // What ← → leafs through, and what the neighbour prefetch below reads: the
  // current result order, or the whole catalogue when nothing is filtered.
  const turnOrder = results.length ? results : catalog.listed;

  // ← → leaf between entries while the codex is open (wraps around)
  const turnPage = useCallback(
    (dir: -1 | 1) => {
      if (!selectedSlug || turnOrder.length < 2) return;
      const i = turnOrder.findIndex((r) => r.slug === selectedSlug);
      if (i === -1) return;
      audio.pageTurn();
      openEntry(turnOrder[(i + dir + turnOrder.length) % turnOrder.length].slug);
    },
    [selectedSlug, turnOrder, openEntry],
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

  const toggleEffects = () => {
    audio.click();
    setEffectsEnabled(!fx.on);
  };

  // The reader's switch has to reach CSS as well as React: it is what lets the
  // ornaments run on a machine that asks for reduced motion (index.css, foot).
  useEffect(() => {
    document.documentElement.dataset.fx = fx.on ? "on" : "off";
  }, [fx.on]);

  const selectedRecord = selectedSlug ? (catalog.bySlug.get(selectedSlug) ?? null) : null;

  // Single owner of the body scroll lock. Keyed on *whether* a codex is open,
  // never on which one: depending on the record would unlock and re-lock the
  // body on every ← →, and letting the page scrollbar back for even one commit
  // reflows the whole grid underneath the modal for nothing.
  const codexOpen = selectedRecord !== null;
  useEffect(() => {
    if (!codexOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [codexOpen]);

  // With a codex open, ← → is one keypress away, so read the pages either side
  // of it while the machine is idle. Two small requests buy a turn that
  // resolves from memory instead of from the network (see catalog.peekEntry).
  useEffect(() => {
    if (!selectedSlug || turnOrder.length < 2) return;
    const i = turnOrder.findIndex((r) => r.slug === selectedSlug);
    if (i === -1) return;
    const warm = () => {
      for (const dir of [-1, 1]) {
        const neighbour = turnOrder[(i + dir + turnOrder.length) % turnOrder.length];
        if (neighbour.slug !== selectedSlug) prefetchEntry(neighbour.entry, pickContentLang(neighbour.langs, lang));
      }
    };
    // Safari still has no requestIdleCallback; a short timer is close enough
    // for two prefetches, and the two handle spaces must not be crossed.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 400);
    return () => window.clearTimeout(id);
  }, [selectedSlug, turnOrder, lang]);

  return (
    <div className="relative min-h-screen">
      <Background />
      {/* Paints over the static backdrop (same layer, later in the DOM) and
          under everything else. Idle while a codex covers it. */}
      <MusicalDrift paused={!!selectedRecord} />

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
          {EFFECTS.enabled && (
            <CtrlButton active={fx.on} onClick={toggleEffects} title={fx.on ? t("fx.on") : t("fx.off")}>
              <span className="text-sm" aria-hidden>
                ✨
              </span>
            </CtrlButton>
          )}
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
        <HeraldBanner facts={facts.bySlug} onOpenEntry={openEntry} />

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
              criteria={criteria}
              onPatch={patchCriteria}
              onReset={resetRefinements}
              types={facets.types}
              countries={facets.countries}
              resultCount={results.length}
              totalCount={catalog.listed.length}
              dossier={{
                active: compiled.needsDossier,
                progress: facts.progress,
                done: facts.done,
              }}
            />

            {/* While a long query is still being ranked, dim rather than block */}
            <div
              className={clsx(
                "mt-10 transition-opacity duration-200",
                criteria !== deferredCriteria && "opacity-60",
              )}
            >
              <CharacterGrid records={results} nativeCount={nativeCount} onSelect={openEntry} />
            </div>
          </>
        )}

      </main>

      <SiteFooter hasEntry={(slug) => catalog.bySlug.has(slug)} onOpenEntry={openEntry} />

      {/* The codex gets a boundary of its own: a chunk that will not import, or
          an entry whose content will not render, then costs the reader that
          entry instead of the grid. `resetKey` re-arms it per entry — keying the
          boundary itself would remount AnimatePresence and kill the ← → turn. */}
      <ErrorBoundary
        label="codex"
        resetKey={selectedSlug ?? ""}
        fallback={selectedRecord ? <CodexError onClose={() => openEntry(null)} /> : null}
      >
        <Suspense fallback={selectedRecord ? <CodexFallback /> : null}>
          {/* Deliberately unkeyed. Keying on the slug made every ← → a full
              teardown and rebuild — two modals alive at once through the
              crossfade, two full-viewport backdrop blurs, the 0.85 s opening
              turn replayed, the article refetched from scratch. The shell now
              persists and only its contents change; CodexModal keys the *view*
              so the reader still lands on the Biography tab of the new entry.
              See CodexShell's header comment. */}
          <AnimatePresence>
            {selectedRecord && (
              <LazyCodexModal
                record={selectedRecord}
                onClose={() => openEntry(null)}
                onTurn={turnPage}
                onNavigateEntry={openLinkedEntry}
              />
            )}
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>
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

/** The codex refused to open. Closing returns the reader to an intact grid; a
 *  retry is not offered because React caches a rejected `lazy()` payload, so
 *  only a reload can fetch the chunk again — which the message says. */
function CodexError({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-ink-950/40 px-6 backdrop-blur-[2px]"
      role="alert"
    >
      <div className="parchment ornate-border max-w-md px-8 py-7 text-center">
        <p className="font-display text-xl text-burgundy-600">{t("app.crashCodex")}</p>
        <button onClick={onClose} className="btn-rpg mt-5">
          {t("codex.close")}
        </button>
      </div>
    </div>
  );
}
