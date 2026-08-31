import type { ResolvedGuestbookConfig } from '../config/defaults';
import type { ApiErrorBody } from './types';

/**
 * Fehler mit dem stabilen Fehlercode der API (z. B. "not_found", "banned",
 * "validation_failed"). Das Frontend entscheidet anhand des Codes, nicht anhand
 * der Meldung — die ist fuer Menschen, nicht fuer Programmlogik.
 *
 * Teil des oeffentlichen Vertrags: die Host-Anwendung kann in `onError` darauf
 * pruefen, ohne den Meldungstext zu parsen.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** true, wenn ein erneuter Versuch sinnvoll sein kann. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 0 || this.code === 'network_error';
  }
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal | undefined;
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, csrfToken: string, options?: RequestOptions): Promise<T>;
  upload<T>(path: string, form: FormData, csrfToken: string, options?: RequestOptions): Promise<T>;
}

/**
 * Wertet eine Antwort aus und normalisiert Fehler zu ApiError.
 *
 * Ausgelagert, weil get, post und upload sich hier vollstaendig gleich
 * verhalten muessen — sonst behandelt ein Aufrufer Fehler anders als die anderen.
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let parsed: unknown = null;

  if (raw.trim() !== '') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Kein JSON: typischerweise eine HTML-Fehlerseite des Webservers, etwa
      // wenn die Rewrite-Regel nicht greift oder PHP abgestuerzt ist.
      throw new ApiError(response.status, 'invalid_response', 'Die API hat kein JSON geliefert.');
    }
  }

  if (!response.ok) {
    const body = parsed as Partial<ApiErrorBody> | null;
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'http_error',
      error?.message ?? `HTTP ${response.status}`,
      error?.details ?? {},
    );
  }

  return parsed as T;
}

/**
 * Baut den HTTP-Client aus der Laufzeitkonfiguration.
 *
 * Frueher standen Basis-URL und `credentials` als Modul-Konstanten in dieser
 * Datei, gelesen aus `import.meta.env` beim Import. Das ist fuer ein
 * eingebettetes Package nicht haltbar: die Umgebungsvariablen gehoeren dann der
 * Host-Anwendung und stehen zur Bauzeit dieses Packages gar nicht fest. Alles
 * Konfigurierbare kommt deshalb pro Instanz herein.
 */
export function createHttpClient(config: ResolvedGuestbookConfig): HttpClient {
  const doFetch: typeof fetch = config.fetch ?? ((...args) => globalThis.fetch(...args));

  const buildUrl = (path: string, query?: RequestOptions['query']): string => {
    const url = `${config.apiBaseUrl}/${path.replace(/^\/+/, '')}`;
    if (!query) return url;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();

    return qs === '' ? url : `${url}?${qs}`;
  };

  const extraHeaders = (): Record<string, string> =>
    typeof config.headers === 'function' ? config.headers() : (config.headers ?? {});

  /**
   * Ein Netzwerkfehler ist der einzige Fall, in dem `fetch` selbst wirft.
   * AbortError wird durchgereicht: das ist kein Fehler, sondern ein
   * abgebrochener Request (Komponente unmounted oder neue Anfrage gestartet).
   */
  const send = async (input: string, init: RequestInit): Promise<Response> => {
    try {
      return await doFetch(input, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError(0, 'network_error', 'Die API ist nicht erreichbar.');
    }
  };

  return {
    async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const response = await send(buildUrl(path, options.query), {
        method: 'GET',
        headers: { Accept: 'application/json', ...extraHeaders() },
        credentials: config.credentials,
        signal: options.signal ?? null,
      });

      return parseResponse<T>(response);
    },

    /**
     * POST mit JSON-Body und CSRF-Token.
     *
     * `credentials` ist Pflicht: das CSRF-Cookie muss mitgehen, damit der Server
     * es gegen den Header vergleichen kann (Double-Submit). Der Content-Type ist
     * bewusst `application/json` — der Server lehnt alles andere ab, weil ein
     * klassisches HTML-Formular kein JSON senden kann und damit die
     * verbreitetste CSRF-Variante ausfaellt.
     */
    async post<T>(
      path: string,
      body: unknown,
      csrfToken: string,
      options: RequestOptions = {},
    ): Promise<T> {
      const response = await send(buildUrl(path, options.query), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          ...extraHeaders(),
        },
        credentials: config.credentials,
        body: JSON.stringify(body),
        signal: options.signal ?? null,
      });

      return parseResponse<T>(response);
    },

    /**
     * Datei-Upload als multipart/form-data.
     *
     * Der Content-Type wird absichtlich NICHT gesetzt — der Browser muss ihn
     * samt multipart-Boundary selbst erzeugen. Setzt man ihn manuell, fehlt die
     * Boundary und PHP findet nichts in $_FILES.
     */
    async upload<T>(
      path: string,
      form: FormData,
      csrfToken: string,
      options: RequestOptions = {},
    ): Promise<T> {
      const response = await send(buildUrl(path, options.query), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': csrfToken,
          ...extraHeaders(),
        },
        credentials: config.credentials,
        body: form,
        signal: options.signal ?? null,
      });

      return parseResponse<T>(response);
    },
  };
}
