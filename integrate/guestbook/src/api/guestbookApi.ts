import { resolveGuestbookConfig } from '../config/defaults';
import type { GuestbookConfig } from '../types';
import { createHttpClient, type HttpClient } from './client';
import type {
  CaptchaChallenge,
  CommentDraft,
  CommentListResponse,
  CommentPreviewResponse,
  CommentSubmitResponse,
  CountryListResponse,
  CsrfTokenResponse,
  EntryDraft,
  EntryListResponse,
  EntryPreviewResponse,
  EntryResponse,
  EntrySubmitResponse,
  FormConfig,
  PictureUploadResponse,
} from './types';

/**
 * Alle Endpunkte, die das Guestbook benutzt — als ein Objekt statt als lose
 * Modul-Funktionen.
 *
 * Zwei Gruende: die Basis-URL ist jetzt Laufzeitkonfiguration und muss pro
 * Instanz gebunden werden, und die Host-Anwendung kann dieses Objekt komplett
 * ersetzen (`<Guestbook api={…} />`) — fuer Tests, Storybook oder einen eigenen
 * Proxy, ohne dass hier irgendetwas davon wissen muss.
 */
export interface GuestbookApi {
  fetchEntries(
    params: { page?: number; pageSize?: number },
    signal?: AbortSignal,
  ): Promise<EntryListResponse>;
  fetchEntry(id: number, signal?: AbortSignal): Promise<EntryResponse>;

  fetchComments(entryId: number, signal?: AbortSignal): Promise<CommentListResponse>;
  previewComment(
    entryId: number,
    draft: CommentDraft,
    csrfToken: string,
  ): Promise<CommentPreviewResponse>;
  submitComment(
    entryId: number,
    draft: CommentDraft,
    csrfToken: string,
  ): Promise<CommentSubmitResponse>;

  fetchFormConfig(signal?: AbortSignal): Promise<FormConfig>;
  fetchCountries(language: string, signal?: AbortSignal): Promise<CountryListResponse>;
  fetchCsrfToken(signal?: AbortSignal): Promise<CsrfTokenResponse>;
  fetchCaptcha(signal?: AbortSignal): Promise<CaptchaChallenge>;

  previewEntry(draft: EntryDraft, csrfToken: string): Promise<EntryPreviewResponse>;
  submitEntry(draft: EntryDraft, csrfToken: string): Promise<EntrySubmitResponse>;
  uploadPicture(file: File, csrfToken: string): Promise<PictureUploadResponse>;
}

/** Bindet die Endpunkte an einen HTTP-Client. */
export function createGuestbookApiFromClient(
  http: HttpClient,
  defaults: { pageSize?: number | undefined } = {},
): GuestbookApi {
  return {
    fetchEntries: (params, signal) =>
      http.get<EntryListResponse>('entries', {
        query: { page: params.page, pageSize: params.pageSize ?? defaults.pageSize },
        signal,
      }),

    fetchEntry: (id, signal) => http.get<EntryResponse>(`entries/${id}`, { signal }),

    fetchComments: (entryId, signal) =>
      http.get<CommentListResponse>(`entries/${entryId}/comments`, { signal }),

    previewComment: (entryId, draft, csrfToken) =>
      http.post<CommentPreviewResponse>(`entries/${entryId}/comments/preview`, draft, csrfToken),

    submitComment: (entryId, draft, csrfToken) =>
      http.post<CommentSubmitResponse>(`entries/${entryId}/comments`, draft, csrfToken),

    fetchFormConfig: (signal) => http.get<FormConfig>('form-config', { signal }),

    fetchCountries: (language, signal) =>
      http.get<CountryListResponse>('countries', { query: { language }, signal }),

    fetchCsrfToken: (signal) => http.get<CsrfTokenResponse>('csrf-token', { signal }),

    fetchCaptcha: (signal) => http.get<CaptchaChallenge>('captcha', { signal }),

    previewEntry: (draft, csrfToken) =>
      http.post<EntryPreviewResponse>('entries/preview', draft, csrfToken),

    submitEntry: (draft, csrfToken) => http.post<EntrySubmitResponse>('entries', draft, csrfToken),

    uploadPicture: (file, csrfToken) => {
      const form = new FormData();
      form.append('picture', file);

      // Kein Content-Type setzen: den muss der Browser samt multipart-Boundary
      // selbst erzeugen.
      return http.upload<PictureUploadResponse>('uploads/picture', form, csrfToken);
    },
  };
}

/**
 * Bequemer Einstieg fuer die Host-Anwendung: API-Objekt direkt aus einer
 * Teilkonfiguration, fehlende Werte kommen aus den Standardwerten.
 *
 * Nuetzlich, um Eintraege vorab zu laden oder in einem Test gegen die echte API
 * zu pruefen, ohne die Komponente zu mounten.
 */
export function createGuestbookApi(config: Partial<GuestbookConfig> = {}): GuestbookApi {
  const resolved = resolveGuestbookConfig(config);

  return createGuestbookApiFromClient(createHttpClient(resolved), { pageSize: resolved.pageSize });
}
