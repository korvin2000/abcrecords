// OOP Character model — encapsulates metadata + biography markup + rich media.

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CharacterMetadata {
  firstName: string;
  surname: string;
  nationality: string;
  gender: "Male" | "Female";
  age: number;
}

export interface CharacterData {
  id: string;
  metadata: CharacterMetadata;
  class: string;
  level: number;
  alignment: string;
  portrait: string;
  accent: string;
  bgImage?: string;
  stats: CharacterStats;
  skills: { name: string; rank: number }[];
  equipment: string[];
  quote: string;
  /** HTML biography with embedded media. */
  biography: string;
}

/**
 * Character — rich domain object.
 * Computes derived values (full name, initials, power rating)
 * and exposes render helpers.
 */
export class Character {
  readonly id: string;
  readonly metadata: CharacterMetadata;
  readonly data: CharacterData;

  constructor(data: CharacterData) {
    this.data = data;
    this.id = data.id;
    this.metadata = data.metadata;
  }

  get fullName(): string {
    return `${this.metadata.firstName} ${this.metadata.surname}`;
  }

  get initials(): string {
    return (this.metadata.firstName[0] + this.metadata.surname[0]).toUpperCase();
  }

  /** Simple weighted "power rating" for sort / display. */
  get powerRating(): number {
    const s = this.data.stats;
    return (
      s.strength +
      s.dexterity +
      s.constitution +
      s.intelligence +
      s.wisdom +
      s.charisma
    );
  }

  /** Levenshtein-ish fuzzy match for search. */
  matches(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = `${this.fullName} ${this.data.class} ${this.metadata.nationality}`.toLowerCase();
    if (hay.includes(q)) return true;
    // Split query by word and require all words match
    const words = q.split(/\s+/);
    return words.every((w) => hay.includes(w));
  }
}
