// ============================================================
//  Procedural generation — seeded RNG + attribute / hero synthesis.
//  Pure functions: deterministic given a seed, used to (a) roll the
//  attributes of summoned wanderers and (b) demonstrate random data
//  generation in a reproducible way.
// ============================================================

import type { Character, Stat, ThemeSpec } from "@/types/character";

/** mulberry32 — tiny, fast, deterministic PRNG. */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32-bit unsigned seed. */
export function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const STAT_DEFS: { key: string; label: string; icon: string }[] = [
  { key: "might", label: "Might", icon: "⚔️" },
  { key: "agility", label: "Agility", icon: "🏹" },
  { key: "intellect", label: "Intellect", icon: "📜" },
  { key: "resolve", label: "Resolve", icon: "🛡️" },
  { key: "arcana", label: "Arcana", icon: "✨" },
  { key: "charisma", label: "Charisma", icon: "👑" },
];

const clamp = (n: number, lo = 6, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Roll six attributes from a seed, biased toward one primary stat. */
export function generateStats(seed: number, primary?: string): Stat[] {
  const rng = mulberry32(seed);
  return STAT_DEFS.map((d) => {
    const base = 35 + rng() * 45;
    const bias = d.key === primary ? 18 + rng() * 22 : 0;
    const jitter = (rng() - 0.5) * 14;
    return { key: d.key, label: d.label, value: clamp(base + bias + jitter) };
  });
}

/** Derived "power rating" — a weighted average (a small mathematical model). */
export function powerRating(stats: Stat[]): number {
  const weights: Record<string, number> = {
    might: 1.1,
    agility: 1,
    intellect: 1.05,
    resolve: 1,
    arcana: 1.15,
    charisma: 0.9,
  };
  let sum = 0;
  let wsum = 0;
  for (const s of stats) {
    const w = weights[s.key] ?? 1;
    sum += s.value * w;
    wsum += w;
  }
  return Math.round(sum / wsum);
}

// ---- random hero synthesis ------------------------------------------

const NAME_A = ["Vael", "Korin", "Syl", "Draven", "Mira", "Thane", "Ilys", "Rav", "Zeph", "Nox", "Eldr", "Vesper", "Orin", "Cal", "Bryn"];
const NAME_B = ["Stormrider", "Nightveil", "Ashforged", "Dawnbreaker", "Gloomwhisper", "Ironfang", "Sunsteel", "Hollowmoor", "Brightblade", "Shadowmere", "Voidwalker", "Galeheart"];
const SPECIES = ["Human", "Half-Elf", "Dwarf", "Tiefling", "Dragonborn", "Gnome", "Genasi", "Orc"];
const ARCHETYPES = ["Ranger", "Knight", "Sorcerer", "Rogue", "Cleric", "Barbarian", "Bard", "Druid"];
const ELEMENTS = ["Storm", "Frost", "Flame", "Shadow", "Light", "Nature", "Void", "Iron"];
const REALMS = ["The Pale Coast", "Vaelmark", "Khaldur", "The Undercity", "Sylvan Reach", "The Grit Wastes", "Celestine Isles", "The Shrouded Marches"];

export const THEME_SCALES: Record<string, number[]> = {
  pentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

const SCALE_NAMES = Object.keys(THEME_SCALES);
const ROOTS = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440];
const WAVES: OscillatorType[] = ["sine", "triangle", "sawtooth", "square"];

const BIO_OPENERS = [
  "Few records survive of {name}, and fewer still agree.",
  "The tavern ballads of {name} grow wilder with every telling.",
  "Whispered in the same breath as cautionary tales, {name} needs little introduction.",
  "To speak the name {name} in certain halls is to invite a long, uneasy silence.",
];
const BIO_MIDDLES = [
  "Trained in the hard school of the {realm}, they learned early that survival favours the patient.",
  "An oath taken beneath a bleeding moon still binds them — though the terms remain their own.",
  "Where {element} gathers, {name} is said to follow, a shadow trailing its own storm.",
  "Coin, cause, or curiosity — their loyalty is bought in the currency of the moment.",
];
const BIO_CLOSERS = [
  "Whether saviour or scourge depends entirely on which side of the gate you stand.",
  "The codex lists them as *unverified*; the cemeteries tell a different story.",
  "Seek them if you must. Bring gold, bring humility, and never bring demands.",
  "Their legend is unfinished — and they prefer it that way.",
];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export interface HeroPools {
  portraits: string[];
  scenes: { src: string; caption: string }[];
}

/** Compose a brand-new, fully-typed Character document from random pools. */
export function buildRandomHero(pools: HeroPools): Character {
  const rng = mulberry32((Math.random() * 1e9) >>> 0);
  const firstName = pick(rng, NAME_A);
  const surname = pick(rng, NAME_B);
  const id = `wanderer-${firstName}-${surname}-${Math.floor(rng() * 9999)}`;
  const species = pick(rng, SPECIES);
  const archetype = pick(rng, ARCHETYPES);
  const element = pick(rng, ELEMENTS);
  const realm = pick(rng, REALMS);
  const gender = pick(rng, ["Female", "Male", "Nonbinary"] as const);
  const rarity = pick(rng, ["Rare", "Epic", "Legendary"] as const);
  const accent = pick(rng, ["#34d3b8", "#a78bfa", "#e6c25b", "#f87171", "#60a5fa"]);
  const scaleName = pick(rng, SCALE_NAMES);
  const theme: ThemeSpec = {
    root: pick(rng, ROOTS),
    scale: THEME_SCALES[scaleName],
    tempo: 64 + Math.floor(rng() * 36),
    wave: pick(rng, WAVES),
    bass: pick(rng, ["sine", "triangle"] as OscillatorType[]),
  };

  const stats = generateStats(hashStr(id), archetype.toLowerCase());

  const name = `${firstName} ${surname}`;
  const bio = [
    pick(rng, BIO_OPENERS).replace("{name}", name),
    pick(rng, BIO_MIDDLES)
      .replace(/\{name\}/g, name)
      .replace(/\{realm\}/g, realm)
      .replace(/\{element\}/g, element.toLowerCase()),
    "",
    `> *"The {realm} remembers. I simply collect what it is owed."*`,
    "",
    pick(rng, BIO_CLOSERS).replace("{name}", name),
  ].join("\n");

  const gallery = Array.from({ length: 2 }, () => pick(rng, pools.scenes));

  return {
    meta: {
      id,
      firstName,
      surname,
      nationality: realm,
      gender,
      age: 18 + Math.floor(rng() * 220),
      species,
      archetype,
      element,
      rarity,
      title: "the Unbound",
      born: `Year ${400 + Math.floor(rng() * 600)} of the Ashen Era`,
      accent,
    },
    portrait: pick(rng, pools.portraits),
    stats,
    biography: bio,
    quote: "I am the page they dare not write.",
    aliases: ["The Unbound", "Nameless Wanderer"],
    gallery,
    relations: [],
    theme,
  };
}
