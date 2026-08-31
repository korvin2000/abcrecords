/**
 * Typen des JSON-Vertrags mit der PHP-REST-API.
 *
 * Diese Datei ist die einzige Stelle, an der die Struktur der API-Antworten
 * beschrieben wird — sie muss zu backend/src/Service/EntryPresenter.php passen.
 * Weicht sie ab, schlaegt `npm run typecheck` fehl, nicht erst die Laufzeit.
 */

export interface Country {
  id: number;
  /** Laendercode wie "DE"; bei translate=true ein Uebersetzungsschluessel. */
  code: string;
  /** true = Anzeigename kommt aus der i18n, false = code ist Literaltext. */
  translate: boolean;
  flagUrl: string | null;
}

export interface EntryPicture {
  url: string;
  /** Bereits gerendertes, sicheres HTML (Badword-gefiltert). */
  caption: string | null;
}

export interface EntryRating {
  boxId: number;
  value: number;
}

export interface EntryCustomField {
  fieldId: number;
  /** Bereits gerendertes, sicheres HTML. */
  value: string;
}

export interface EntryHomepage {
  /** Vollstaendige, serverseitig geprueffte http(s)-URL. */
  url: string;
  /** Anzeigeform, wie der Besucher sie eingegeben hat. */
  label: string;
}

/** Abgeleitete Client-Information; der rohe User-Agent wird nie ausgeliefert. */
export interface EntryClient {
  browser: string | null;
  os: string | null;
}

/** Bekannte Messenger-Felder; alle optional, leere werden weggelassen. */
export interface EntryMessengers {
  icq?: string;
  aim?: string;
  msn?: string;
  yahoo?: string;
  skype?: string;
  jabber?: string;
  gaduGadu?: string;
}

/** Platzhalter fuer einen passwortgeschuetzten Eintrag. */
export interface LockedEntry {
  id: number;
  number: number;
  sticky: boolean;
  date: string | null;
  time: string | null;
  isPrivate: true;
  locked: true;
}

export interface VisibleEntry {
  id: number;
  number: number;
  sticky: boolean;
  date: string | null;
  time: string | null;
  isPrivate: boolean;
  locked: false;
  name: string;
  /** Sicheres HTML (escapt, Badword-gefiltert). */
  nameHtml: string;
  /** Sicheres HTML: BBCode gerendert, Emoticons eingesetzt. */
  textHtml: string;
  /** Anmerkung eines Admins am Eintrag (ENTRY.COMMENT), gerendert. */
  adminReplyHtml: string | null;
  /** 0 = keine Angabe, 1 = maennlich, 2 = weiblich. */
  gender: number;
  country: Country | null;
  email: string | null;
  homepage: EntryHomepage | null;
  messengers: EntryMessengers;
  picture: EntryPicture | null;
  ratings: EntryRating[];
  customFields: EntryCustomField[];
  commentsClosed: boolean;
  commentCount: number;
  client: EntryClient | null;
}

export type Entry = VisibleEntry | LockedEntry;

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EntryListResponse {
  items: Entry[];
  pagination: Pagination;
}

export interface EntryResponse {
  item: Entry;
}

export interface Comment {
  id: number;
  entryId: number;
  date: string | null;
  time: string | null;
  name: string;
  /** Sicheres HTML (escapt, Badword-gefiltert). */
  nameHtml: string;
  /** Sicheres HTML: BBCode gerendert. */
  textHtml: string;
  email: string | null;
  /** Reines Anzeige-Flag: Antwort der Administration. */
  isAdmin: boolean;
}

export interface CommentListResponse {
  items: Comment[];
  meta: {
    entryId: number;
    /** Kommentare zu diesem Eintrag geschlossen (ENTRY.CLOSED). */
    closed: boolean;
    /** Kommentare global erlaubt (SETTINGS.ALLOWCOMMENTS). */
    commentsAllowed: boolean;
    moderated: boolean;
  };
}

// ---------------------------------------------------------------------------
// Formular: Konfiguration, Entwurf, Antworten
// ---------------------------------------------------------------------------

/** Ein Feld des Eintragsformulars, wie SETTINGS es konfiguriert. */
export interface FieldConfig {
  enabled: boolean;
  required: boolean;
  maxLength?: number;
  pattern?: string;
  numeric?: boolean;
}

export interface RatingBoxConfig {
  id: number;
  name: string;
  formText: string;
  required: boolean;
  maxValue: number;
}

export type CustomFieldConfig = {
  id: number;
  name: string;
  formText: string;
  required: boolean;
  multiline: boolean;
  default: string | null;
} & (
  | { type: 'text'; maxLength: number }
  | { type: 'number'; min: number; max: number }
  | { type: 'select'; options: Array<{ value: string; label: string }> }
);

export interface FormConfig {
  fields: Record<string, FieldConfig>;
  ratingBoxes: RatingBoxConfig[];
  customFields: CustomFieldConfig[];
  captcha: { required: boolean };
  comments: { allowed: boolean };
  search: { allowed: boolean };
  moderation: { enabled: boolean };
  text: {
    bbcode: {
      enabled: boolean;
      tags: string[];
      sizeRange: [number, number];
      namedColors: Array<{ name: string; value: string }>;
    };
    emoticons: boolean;
  };
  picture: {
    enabled: boolean;
    maxFileSize: number;
    allowedTypes: string[];
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    thumbnailWidth: number;
    thumbnailHeight: number;
  };
}

export interface CountryListResponse {
  items: Country[];
}

export interface CsrfTokenResponse {
  token: string;
  header: string;
  expiresIn: number;
}

/** `required: false` heisst: SETTINGS.USETICKETS schaltet das Captcha ab. */
export interface CaptchaChallenge {
  required: boolean;
  token?: string;
  /** PNG als data:-URI — der Klartext des Codes verlaesst den Server nie. */
  image?: string;
  expiresIn?: number;
}

/** Was das Formular an die API schickt. */
export interface EntryDraft {
  name: string;
  text: string;
  email?: string;
  homepage?: string;
  country?: number | '';
  gender?: number;
  hideEmail?: boolean;
  private?: string;
  /** Dateiname aus einem vorherigen Upload (PictureUploadResponse.filename). */
  picture?: string;
  pictureCaption?: string;
  icq?: string;
  aim?: string;
  msn?: string;
  yahoo?: string;
  skype?: string;
  jabber?: string;
  gaduGadu?: string;
  ratings?: Record<number, number>;
  customFields?: Record<number, string>;
  captchaToken?: string;
  captchaAnswer?: string;
  /** Honeypot — muss leer bleiben. Bots fuellen es aus. */
  website?: string;
}

export interface EntryPreviewResponse {
  preview: {
    name: string;
    nameHtml: string;
    textHtml: string;
    gender: number;
    country: Country | null;
    email: string | null;
    homepage: string | null;
    isPrivate: boolean;
  };
}

export interface PictureUploadResponse {
  /** Dateiname der Vorschaudatei; beim Absenden als `picture` mitschicken. */
  filename: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface EntrySubmitResponse {
  id: number;
  moderated: boolean;
  visible: boolean;
  mail: { admin: boolean; author: boolean };
}

/** Feldfehler aus einer 422-Antwort: Feldname → Fehlercode. */
export type FieldErrors = Record<string, string>;

/** Was das Kommentarformular an die API schickt. */
export interface CommentDraft {
  name: string;
  text: string;
  email?: string;
  captchaToken?: string;
  captchaAnswer?: string;
  /** Honeypot — muss leer bleiben. */
  website?: string;
}

export interface CommentPreviewResponse {
  preview: {
    name: string;
    nameHtml: string;
    textHtml: string;
  };
}

export interface CommentSubmitResponse {
  id: number;
  entryId: number;
  moderated: boolean;
  visible: boolean;
}

/** Fehlerformat der API: {"error":{"code":"...","message":"...","details":{...}}} */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function isLocked(entry: Entry): entry is LockedEntry {
  return entry.locked;
}
