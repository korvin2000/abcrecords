// ============================================================
//  Domain Model — each character card is a structured document
//  (typed JSON metadata + a Markdown biography + mixed media).
// ============================================================

export type Gender = "Female" | "Male" | "Nonbinary";

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

/** The strict metadata envelope — the "JSON document" of the card. */
export interface CharacterMeta {
  id: string;
  firstName: string;
  surname: string;
  nationality: string; // realm / region of origin
  gender: Gender;
  age: number;
  species: string; // e.g. "High Elf"
  archetype: string; // e.g. "Ranger"
  element: string; // e.g. "Nature"
  rarity: Rarity;
  title: string; // epithet
  born: string; // in-world year / era
  accent: string; // hex accent colour driving the card glow
}

/** A single rated attribute (0–100). */
export interface Stat {
  key: string;
  label: string;
  value: number;
}

/** Procedural theme-music description (rendered live by the audio engine). */
export interface ThemeSpec {
  root: number; // base frequency in Hz
  scale: number[]; // semitone offsets
  tempo: number; // bpm
  wave: OscillatorType; // lead timbre
  bass: OscillatorType;
}

export interface GalleryImage {
  src: string;
  caption: string;
}

/** Cross-document link to another character. */
export interface Relation {
  targetId: string;
  label: string; // e.g. "Sworn ally", "Rival"
}

/** The full character document = metadata + markdown biography + media. */
export interface Character {
  meta: CharacterMeta;
  portrait: string; // inlined asset URL (import)
  stats: Stat[];
  biography: string; // Markdown
  quote: string;
  aliases: string[];
  gallery: GalleryImage[];
  relations: Relation[];
  theme: ThemeSpec;
}

// ---- Rarity → presentation mapping -----------------------------------

export interface RarityStyle {
  label: string;
  glow: string; // rgba for box-shadow / glow
  border: string; // css color
  text: string; // tailwind text color token
  stars: number; // 1–5
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  Common: { label: "Common", glow: "rgba(148,163,184,0.45)", border: "#64748b", text: "text-slate-300", stars: 1 },
  Rare: { label: "Rare", glow: "rgba(52,211,184,0.55)", border: "#34d3b8", text: "text-arcane-300", stars: 2 },
  Epic: { label: "Epic", glow: "rgba(167,139,250,0.6)", border: "#a78bfa", text: "text-mystic-300", stars: 3 },
  Legendary: { label: "Legendary", glow: "rgba(230,194,91,0.7)", border: "#e6c25b", text: "text-gold-300", stars: 4 },
  Mythic: { label: "Mythic", glow: "rgba(248,113,113,0.7)", border: "#f87171", text: "text-ember-300", stars: 5 },
};
