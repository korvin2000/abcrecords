import type { GuestbookConfig } from '../types';

/**
 * Liest eine Vite-Umgebungsvariable, ohne sich auf `vite/client`-Typen oder
 * ueberhaupt auf Vite zu verlassen.
 *
 * Als eigenstaendige SPA war `import.meta.env.VITE_API_BASE_URL` die einzige
 * Quelle der API-URL. Eingebettet ist sie nur noch die *unterste* Ebene: die
 * Variablen gehoeren dann der Host-Anwendung, die sie unter Umstaenden gar
 * nicht definiert. Ein direkter Zugriff wuerde in einem Nicht-Vite-Build
 * werfen, daher der Schutz.
 */
function readEnv(name: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const value = env?.[name];

    return typeof value === 'string' && value !== '' ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Standard-API-Pfad.
 *
 * Reihenfolge: eine ausdruecklich fuer das Guestbook gedachte Variable der
 * Host-Anwendung, dann die der eigenstaendigen SPA, dann der Pfad der
 * Installation neben der Alt-Anwendung. Ueber `config.apiBaseUrl` laesst sich
 * alles davon uebersteuern — das ist der Weg, den eine Host-Anwendung nehmen
 * sollte, weil er nicht vom Build abhaengt.
 */
function defaultApiBaseUrl(): string {
  return (
    readEnv('VITE_GUESTBOOK_API_BASE_URL') ?? readEnv('VITE_API_BASE_URL') ?? '/gbook/api'
  );
}

export const GUESTBOOK_CONFIG_DEFAULTS: Readonly<GuestbookConfig> = Object.freeze({
  apiBaseUrl: '/gbook/api',
  credentials: 'same-origin' as RequestCredentials,
  storageNamespace: 'viper-guestbook',
  persistDraft: true,
  persistLocale: true,
  scrollBehavior: 'container' as const,
  anchorPrefix: 'entry-',
});

/** Vollstaendig aufgeloeste Konfiguration; alle Pflichtfelder sind gesetzt. */
export type ResolvedGuestbookConfig = GuestbookConfig;

export function resolveGuestbookConfig(
  partial: Partial<GuestbookConfig> | undefined,
): ResolvedGuestbookConfig {
  const merged: GuestbookConfig = {
    ...GUESTBOOK_CONFIG_DEFAULTS,
    apiBaseUrl: partial?.apiBaseUrl ?? defaultApiBaseUrl(),
    ...Object.fromEntries(Object.entries(partial ?? {}).filter(([, value]) => value !== undefined)),
  } as GuestbookConfig;

  // Genau ein Schraegstrich-Regime: der HTTP-Client haengt Pfade mit `/` an.
  merged.apiBaseUrl = merged.apiBaseUrl.replace(/\/+$/, '');

  return merged;
}

/** `localStorage`-Schluessel im Namensraum der Instanz. */
export function storageKey(config: Pick<GuestbookConfig, 'storageNamespace'>, name: string): string {
  return `${config.storageNamespace}.${name}`;
}
