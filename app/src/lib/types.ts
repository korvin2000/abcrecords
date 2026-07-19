/** One row of pages/index.json — the live search/browse index. */
export interface IndexEntry {
  title: string;
  type: string;
  forename: string;
  surname: string;
  /** Free-text country name (NOT ISO code — a known index.json deviation). */
  country: string;
  /** Root-relative path to the entry's full metadata (leading slash). */
  json: string;
  /** Root-relative path to the BioMD Lite biography (leading slash). */
  md: string;
  /** Bucket-relative path to the preview portrait (no leading slash). */
  img: string;
}

/** Dates in `DD.MM.YYYY`; every field optional — never assume presence. */
export interface EntryDates {
  born?: string;
  died?: string;
  activeFrom?: string;
  activeTo?: string;
}

/** metadata section of a *.bio.json (docs/MetaData.md). Multi-value fields
 *  are comma-separated strings; unknown fields must be preserved/ignored. */
export interface EntryMeta {
  id?: string;
  title?: string;
  birthname?: string;
  gender?: string;
  type?: string;
  surname?: string;
  forename?: string;
  /** ISO 3166-1 alpha-2 here (unlike index.json). */
  country?: string;
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
  bio?: string;
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

/** Lazily-loaded per-entry bundle; either half may be missing on error. */
export interface EntryBundle {
  data: EntryData | null;
  md: string | null;
}
