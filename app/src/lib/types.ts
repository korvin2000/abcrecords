/**
 * Catalogue v2 data shapes.
 *
 * One fact lives in exactly one file (docs/Catalog-Index.md, docs/MetaData.md):
 *   pages/index.json          identity, classification, paths   → IndexEntry
 *   pages/index-<lang>.json   display name + search aliases      → NameIndex
 *   pages/<lang>/*.bio.json   the dossier, one edition per lang  → EntryData
 */

export type Gender = "m" | "f" | "mixed";

/**
 * One row of pages/index.json.
 *
 * Enum-like fields are authored lowercase and read case-insensitively; the
 * loader normalizes them once at the boundary (`country` to UPPERCASE, the
 * rest to lowercase), so nothing downstream ever compares case-insensitively.
 */
export interface IndexEntry {
  /** Stable string, assigned once, never renumbered or reused — the join key
   *  to index-<lang>.json. Not a position, and not the route. */
  id: string;
  /** Latin fallback name, used wherever no localized name is declared. */
  title: string;
  /** Craft ("guitarist"), or "hidden" for routable but unlisted entries. */
  type: string;
  /** Root-relative path to the BioMD article; its basename is the slug, and
   *  therefore the route. The file itself lives in pages/<lang>/. Absent only
   *  on a document entry, which is routed by `pdf` instead. */
  md?: string;
  /**
   * Site-root-relative path to a PDF (`"magazine/2022/issue.pdf"`). Present
   * and `md` absent ⟺ the entry **is** a document: opening it shows the PDF
   * in its own viewer rather than a codex. Never localized — one file serves
   * every edition. See docs/Catalog-Index.md §9.
   */
  pdf?: string;
  /** Comma-separated ISO 639-1 editions ("ru,de"); the first is the entry's
   *  original language. Absent → "ru". */
  lang?: string;
  gender?: Gender;
  /** ISO 3166-1 alpha-2, UPPERCASE after normalization. */
  country?: string;
  /** Root-relative dossier path. Present ⟺ the entry is a biography. */
  json?: string;
  /** Bucket-relative portrait (never localized). Absent → gender default. */
  img?: string;
}

/** pages/index-<lang>.json — id → [display name, ...search-only aliases]. */
export type NameIndex = Readonly<Record<string, readonly string[]>>;

/** Dates in `DD.MM.YYYY`; every field optional — never assume presence. */
export interface EntryDates {
  born?: string;
  died?: string;
  activeFrom?: string;
  activeTo?: string;
}

/**
 * `metadata` section of a *.bio.json (docs/MetaData.md). Multi-value fields
 * are comma-separated strings; unknown fields must be preserved, not rejected.
 *
 * Every prose field is authored in its directory's language — a dossier is a
 * per-language edition, not a translation of an original. Only `dates`,
 * `ranking` and `url` are language-invariant.
 *
 * Identity and classification are NOT here: `id`, `title`, `gender`, `type`
 * and `country` moved to index.json in v2.
 */
export interface EntryMeta {
  forename?: string;
  surname?: string;
  birthname?: string;
  birthplace?: string;
  deathplace?: string;
  dates?: EntryDates;
  relatives?: string;
  instruments?: string;
  genres?: string;
  bands?: string;
  awards?: string;
  teachers?: string;
  disciples?: string;
  jobs?: string;
  ranking?: number;
  url?: string;
  [key: string]: unknown;
}

export interface MediaItem {
  label: string;
  target: string;
}

export interface DocumentItem {
  label: string;
  /** Uppercase symbolic type (TRANSCRIPT, DOSSIER, ARTICLE, …) — open set. */
  type?: string;
  /** "embedded" | relative path | absolute URL. */
  target: string;
}

/** Full *.bio.json document. */
export interface EntryData {
  metadata: EntryMeta;
  media?: { photos?: MediaItem[]; music?: MediaItem[] };
  documents?: DocumentItem[];
}

/** Lazily-loaded per-entry bundle. `data` is null for a page (no dossier
 *  declared) as well as on a failed read; `md` is null only on failure. */
export interface EntryBundle {
  data: EntryData | null;
  md: string | null;
}
