import { StrictMode, Suspense, lazy, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@site/demoscene/locales';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';
import './styles.css';

/**
 * A stand-in for `apps/encyclopedia`. This file is the *host* side of the
 * integration, and it is the thing to copy from — see
 * `docs/demoscene-integration.md`.
 *
 * Four rules are demonstrated here and nowhere else in this repository:
 *
 *  1. §15.2 — the demoscene is a modal, not a route, so it is loaded with
 *     `React.lazy()` declared at module scope.
 *  2. §16 — nothing at module scope statically imports `@site/demoscene`.
 *     The only eager import is `@site/demoscene/locales`, the few-byte
 *     subpath that exists precisely so startup code never has to.
 *  3. §18 — the lazy boundary is also a failure boundary. A demoscene that
 *     fails to download must not white-screen the encyclopedia.
 *  4. §27 — the language crosses the boundary as a plain string prop. The
 *     host keeps owning its own i18n; the demoscene never reads it.
 */
const Demoscene = lazy(() => import('@site/demoscene'));

/** §19 — intent-based preload. Optional, and deliberately hover-only. */
const preloadDemoscene = () => {
  void import('@site/demoscene');
};

/**
 * The host's own chrome copy. Note that it lives *here*, in the host, not in
 * the demoscene's catalogues: the demoscene ships only the strings it renders
 * itself. That includes these picker labels — a language picker is host
 * chrome, and the demoscene has no opinion about how a host names languages.
 */
const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  ja: '日本語',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  uk: 'Українська',
  zh: '中文',
  ko: '한국어',
};

const COPY: Record<'en' | 'ru', Record<string, string>> = {
  en: {
    eyebrow: 'Scriptorium',
    title: 'Codex Harmoniae',
    sub: 'a host application, standing in for the encyclopedia',
    lede:
      'The demoscene behind this button is a lazily-loaded workspace feature ' +
      'package, @site/demoscene. It arrives on click, renders into its own ' +
      'shadow root, carries no runtime dependencies, fetches nothing from the ' +
      'network, and releases everything it touched when it unmounts.',
    open: 'About this work',
    lang: 'Language',
    foot: 'Turn the sound on. It is the better half of the thing.',
    outside:
      'Open the Network panel before clicking: nothing of the demoscene — not ' +
      'the renderer, not the score, not the eleven message catalogues — is on ' +
      'the wire until you do.',
  },
  ru: {
    eyebrow: 'Скрипторий',
    title: 'Codex Harmoniae',
    sub: 'приложение-хозяин, вместо энциклопедии',
    lede:
      'Демосцена за этой кнопкой — лениво загружаемый пакет рабочего ' +
      'пространства @site/demoscene. Он приходит по клику, рендерится в ' +
      'собственный shadow root, не имеет зависимостей во время выполнения, ' +
      'ничего не загружает из сети и освобождает всё при размонтировании.',
    open: 'Об этой работе',
    lang: 'Язык',
    foot: 'Включите звук — это лучшая половина всего.',
    outside:
      'Откройте панель «Сеть» перед нажатием: ничего из демосцены — ни ' +
      'рендерер, ни партитура, ни одиннадцать каталогов перевода — не ' +
      'уходит в сеть, пока вы этого не сделаете.',
  },
};

/**
 * Read the initial locale the way an embedding app would hand it off: a
 * `?locale=xx` (or `?lang=xx`) query parameter on the URL. Falls back to the
 * browser's own language, then to English. Only ever returns a tag the
 * demoscene actually ships copy for — though passing an unknown one is safe
 * too, since `fallbackLocale` catches it.
 */
function initialLocale(): SupportedLocale {
  const known = SUPPORTED_LOCALES as readonly string[];
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search);
    const requested = (q.get('locale') ?? q.get('lang'))?.toLowerCase();
    if (requested && known.includes(requested)) return requested as SupportedLocale;
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language.toLowerCase().split('-')[0] : '';
  return known.includes(nav) ? (nav as SupportedLocale) : 'en';
}

function App() {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  /* the host page's own chrome only ships en/ru copy; the demoscene itself
     carries all eleven */
  const t = COPY[locale === 'ru' ? 'ru' : 'en'];

  /* stable identity: DemosceneApp rebuilds when its options change, and an
     inline arrow would change on every render */
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <main className="leaf">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="sub">{t.sub}</p>

        <div className="rule">
          <i />
          <b>❖</b>
          <i />
        </div>

        <p className="lede">{t.lede}</p>

        <p className="actions">
          <button
            className="open"
            onClick={() => setOpen(true)}
            onPointerEnter={preloadDemoscene}
            onFocus={preloadDemoscene}
          >
            {t.open}
          </button>
          <label className="ghost" style={{ display: 'inline-flex', gap: '0.4em' }}>
            {t.lang}
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as SupportedLocale)}
            >
              {SUPPORTED_LOCALES.map((tag) => (
                <option key={tag} value={tag}>
                  {LOCALE_LABELS[tag]} · {tag}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p className="foot">{t.foot}</p>
        <p className="foot">{t.outside}</p>
      </main>

      {/* Mounted only while open, so the chunk is fetched on the first click
          and the whole production is torn down on close. */}
      {open && (
        <FeatureErrorBoundary name="demoscene" onDismiss={close}>
          <Suspense fallback={null}>
            <Demoscene open locale={locale} onClose={close} />
          </Suspense>
        </FeatureErrorBoundary>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
