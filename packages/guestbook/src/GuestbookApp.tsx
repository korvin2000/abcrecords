import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createGuestbookApiFromClient } from './api/guestbookApi';
import { createHttpClient } from './api/client';
import { resolveGuestbookConfig } from './config/defaults';
import { EntryForm } from './components/EntryForm';
import { EntryList } from './components/EntryList';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useGuestbookLocale } from './hooks/useGuestbookLocale';
import { createGuestbookI18n, DEFAULT_GUESTBOOK_LOCALE, type GuestbookLocale } from './i18n';
import { useGuestbookTranslation } from './i18n/useGuestbookTranslation';
import { GuestbookErrorBoundary } from './runtime/GuestbookErrorBoundary';
import { GuestbookRuntimeProvider, type GuestbookRuntime } from './runtime/context';
import styles, { cx } from './styles';
import type {
  GuestbookCommentPostedEvent,
  GuestbookEntrySubmittedEvent,
  GuestbookErrorContext,
  GuestbookProps,
  GuestbookRouting,
} from './types';

const MEMORY_ROUTING: GuestbookRouting = { mode: 'memory' };

/**
 * Oeffentliche Wurzelkomponente des Guestbooks.
 *
 * Sie ist der einzige Einstiegspunkt des Packages und uebernimmt genau die
 * Aufgaben, die eine eingebettete Anwendung an ihrer Grenze erledigen muss:
 *
 * - Props der Host-Anwendung in eine aufgeloeste Laufzeitkonfiguration
 *   uebersetzen (`config`, `api`, `routing`, Callbacks),
 * - eine eigene i18next-Instanz aufspannen, damit die Sprache dieses Teilbaums
 *   unabhaengig von der Host-Anwendung ist,
 * - einen Feature-Root mit gescopetem CSS und `data-theme` erzeugen,
 * - eine Fehlergrenze setzen, damit ein Fehler hier nicht die Host-Anwendung
 *   mitreisst.
 *
 * Sie mountet **keinen** eigenen React-Root und **keinen** Router und aendert
 * nichts am `document` — das gehoert alles der Host-Anwendung
 * (docs/react-modular-architecture.md, Abschnitte 17, 23, 24).
 */
export function GuestbookApp(props: GuestbookProps) {
  const {
    locale,
    fallbackLocale = DEFAULT_GUESTBOOK_LOCALE,
    onLocaleChange,
    languageSwitcher = 'auto',
    translations,
    config: configOverrides,
    api: apiOverride,
    theme = 'system',
    className,
    style,
    routing = MEMORY_ROUTING,
    header,
    headingLevel = 2,
    showEntryForm = true,
    onError,
    onEntrySubmitted,
    onCommentPosted,
  } = props;

  const rootRef = useRef<HTMLElement | null>(null);
  const idPrefix = useId();

  /*
   * Konfiguration nach WERTEN merken, nicht nach Objekt-Identitaet.
   *
   * Eine Host-Anwendung schreibt fast immer ein Objektliteral hin
   * (`config={{ apiBaseUrl: '…' }}`). Dessen Identitaet aendert sich bei jedem
   * Render der Host-Anwendung; haenge man `useMemo` daran, entstuende bei jedem
   * Render eine neue API-Instanz — und jeder Effekt, der sie in seiner
   * Abhaengigkeitsliste hat, laedt die Eintragsliste erneut. Das ist beim
   * Umschalten der Sprache tatsaechlich passiert.
   *
   * Die einzelnen Felder als Abhaengigkeiten sind ausfuehrlich, aber korrekt:
   * die Host-Anwendung muss dann nichts memoisieren.
   */
  const config = useMemo(
    () => resolveGuestbookConfig(configOverrides),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- absichtlich feldweise
    [
      configOverrides?.apiBaseUrl,
      configOverrides?.credentials,
      configOverrides?.headers,
      configOverrides?.fetch,
      configOverrides?.pageSize,
      configOverrides?.storageNamespace,
      configOverrides?.persistDraft,
      configOverrides?.persistLocale,
      configOverrides?.scrollBehavior,
      configOverrides?.anchorPrefix,
    ],
  );

  /* Dasselbe fuer `routing`: auch das ist typischerweise ein Objektliteral. */
  const routingMode = routing.mode;
  const routingParamPrefix = routing.mode === 'url' ? routing.paramPrefix : undefined;
  const routingInitialPage = routing.mode === 'memory' ? routing.initialPage : undefined;
  const routingPage = routing.mode === 'controlled' ? routing.page : undefined;
  const routingOnPageChange = routing.mode === 'controlled' ? routing.onPageChange : undefined;

  const stableRouting = useMemo<GuestbookRouting>(() => {
    if (routingMode === 'controlled') {
      return {
        mode: 'controlled',
        page: routingPage ?? 1,
        onPageChange: routingOnPageChange ?? (() => undefined),
      };
    }
    if (routingMode === 'url') {
      return { mode: 'url', paramPrefix: routingParamPrefix };
    }

    return { mode: 'memory', initialPage: routingInitialPage };
  }, [routingMode, routingParamPrefix, routingInitialPage, routingPage, routingOnPageChange]);

  /*
   * Callbacks der Host-Anwendung ueber eine Ref stabilisieren.
   *
   * Sonst muesste jede Host-Anwendung ihre Handler in `useCallback` verpacken,
   * weil sie sonst in Effekt-Abhaengigkeitslisten dieses Packages landen und
   * dort Neuladeschleifen ausloesen. Die Ref nimmt ihr diese Pflicht ab: die
   * hier gebauten Wrapper aendern ihre Identitaet nie, rufen aber immer die
   * aktuellen Handler.
   */
  const callbacksRef = useRef({ onError, onEntrySubmitted, onCommentPosted });
  callbacksRef.current = { onError, onEntrySubmitted, onCommentPosted };

  const callbacks = useMemo(
    () => ({
      onError: (error: unknown, context: GuestbookErrorContext) =>
        callbacksRef.current.onError?.(error, context),
      onEntrySubmitted: (event: GuestbookEntrySubmittedEvent) =>
        callbacksRef.current.onEntrySubmitted?.(event),
      onCommentPosted: (event: GuestbookCommentPostedEvent) =>
        callbacksRef.current.onCommentPosted?.(event),
    }),
    [],
  );

  /*
   * Die API-Instanz haengt nur an der Konfiguration. Wuerde sie bei jedem Render
   * neu entstehen, liefe jeder useEffect, der sie in seiner Abhaengigkeitsliste
   * hat, in einer Endlosschleife.
   */
  const api = useMemo(
    () => apiOverride ?? createGuestbookApiFromClient(createHttpClient(config), { pageSize: config.pageSize }),
    [apiOverride, config],
  );

  const { locale: activeLocale, setLocale, controlled } = useGuestbookLocale({
    locale,
    fallbackLocale,
    config,
    onLocaleChange,
  });

  /*
   * i18next-Instanz genau einmal pro Guestbook-Instanz. `translations` wird
   * dabei einmalig eingemischt: die Host-Anwendung uebergibt dort ueblicherweise
   * ein Objektliteral, dessen Identitaet sich bei jedem Render aendert — als
   * Abhaengigkeit waere das eine Endlosschleife.
   */
  const [i18n] = useState(() =>
    createGuestbookI18n({ locale: activeLocale, fallbackLocale, overrides: translations }),
  );

  /*
   * Sprachwechsel an die Instanz durchreichen.
   *
   * Zwingend im Effekt und nicht waehrend des Renders: `changeLanguage` meldet
   * synchron an alle `useTranslation`-Abonnenten, und React lehnt ein setState
   * in einer fremden Komponente waehrend eines Renders ab ("Cannot update a
   * component while rendering a different component"). Ein Frame in der alten
   * Sprache entsteht dadurch nicht — die Instanz wird bereits mit der richtigen
   * Sprache erzeugt, der Effekt greift nur bei spaeteren Wechseln.
   */
  useEffect(() => {
    if (i18n.language !== activeLocale) {
      void i18n.changeLanguage(activeLocale);
    }
  }, [i18n, activeLocale]);

  // Ein neuer Schluessel baut EntryList neu auf — einfacher und weniger
  // fehleranfaellig als eine imperative Refresh-Schnittstelle.
  const [listKey, setListKey] = useState(0);
  const handleSubmitted = useCallback(() => {
    setListKey((key) => key + 1);
  }, []);

  const runtime = useMemo<GuestbookRuntime>(
    () => ({
      config,
      api,
      idPrefix,
      rootRef,
      routing: stableRouting,
      ...callbacks,
    }),
    [config, api, idPrefix, stableRouting, callbacks],
  );

  const showSwitcher =
    languageSwitcher === 'always' ||
    (languageSwitcher === 'auto' && (!controlled || onLocaleChange !== undefined));

  return (
    <GuestbookErrorBoundary locale={activeLocale} onError={callbacks.onError}>
      <GuestbookRuntimeProvider value={runtime}>
        <I18nextProvider i18n={i18n}>
          <section
            ref={rootRef}
            className={cx(styles.root, className)}
            data-theme={theme}
            data-guestbook="root"
            lang={activeLocale}
            style={style}
          >
            {header === false ? null : (
              header ?? (
                <DefaultHeader
                  headingLevel={headingLevel}
                  showSwitcher={showSwitcher}
                  onSelect={setLocale}
                />
              )
            )}

            <div className={styles.pageMain}>
              {showEntryForm && <EntryForm onSubmitted={handleSubmitted} />}
              <EntryList key={listKey} />
            </div>
          </section>
        </I18nextProvider>
      </GuestbookRuntimeProvider>
    </GuestbookErrorBoundary>
  );
}

export default GuestbookApp;

function DefaultHeader({
  headingLevel,
  showSwitcher,
  onSelect,
}: {
  headingLevel: 1 | 2 | 3 | 4;
  showSwitcher: boolean;
  onSelect: (locale: GuestbookLocale) => void;
}) {
  const { t } = useGuestbookTranslation();
  const Heading = `h${headingLevel}` as const;

  return (
    <header className={styles.pageHeader}>
      <div>
        <Heading className={styles.pageTitle}>{t('app.title')}</Heading>
        <p className={styles.pageSubtitle}>{t('app.subtitle')}</p>
      </div>
      {showSwitcher && <LanguageSwitcher onSelect={onSelect} />}
    </header>
  );
}
