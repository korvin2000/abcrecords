/**
 * Script folding — the one normalization both sides of the search agree on.
 *
 * Kept in its own module because it is depended on far outside the search:
 * the dossier facts index folds names with it too, and any second
 * implementation would silently disagree with this one.
 */

const CYR_TO_LAT: Record<string, string[]> = {
  а: ["a"], б: ["b"], в: ["v"], г: ["g"], д: ["d"],
  е: ["e", "ye"], ё: ["e", "yo"], ж: ["zh", "j"], з: ["z"], и: ["i"],
  й: ["y", "i", "j"], к: ["k", "c"], л: ["l"], м: ["m"], н: ["n"],
  о: ["o"], п: ["p"], р: ["r"], с: ["s"], т: ["t"], у: ["u"],
  ф: ["f"], х: ["kh", "h"], ц: ["ts", "c"], ч: ["ch", "c"],
  ш: ["sh"], щ: ["shch", "sch"], ъ: [""], ы: ["y"], ь: [""],
  э: ["e"], ю: ["yu", "iu", "u"], я: ["ya", "ia", "a"],
  // Serbian/Macedonian extras seen in the data
  ј: ["j", "y"], ћ: ["c", "ch"], ђ: ["dj", "d"], љ: ["lj"], њ: ["nj"], џ: ["dz"],
  // Ukrainian extras (и/і are distinct letters there, unlike Russian)
  і: ["i"], ї: ["yi", "i"], є: ["ye", "ie", "e"], ґ: ["g"],
};

const MAX_VARIANTS = 64;

export const CYRILLIC = /[Ѐ-ӿ]/;

/** ASCII-only text is the only kind a transliterated query can match. Written
 *  as a scan rather than a negated character class, so the boundary stays
 *  legible instead of hiding inside escape sequences. */
export function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // Strip combining marks from LATIN letters only (Agustín → agustin).
    // Cyrillic й and ё decompose here too, and their marks are exactly what
    // tells the transliterator й→j/y apart from и→i — NFC puts them back.
    .replace(/([a-z])[̀-ͯ]+/g, "$1")
    .normalize("NFC")
    .replace(/ё/g, "е");
}

/** Bounded cartesian expansion of transliteration alternatives. The first
 *  variant is always the canonical one, so truncation only ever drops the
 *  less likely spellings. */
export function translitVariants(foldedToken: string): string[] {
  let variants = [""];
  for (const ch of foldedToken) {
    const subs = CYR_TO_LAT[ch] ?? [ch];
    const next: string[] = [];
    for (const v of variants) {
      for (const s of subs) {
        next.push(v + s);
        if (next.length >= MAX_VARIANTS) break;
      }
      if (next.length >= MAX_VARIANTS) break;
    }
    variants = next;
  }
  return variants;
}
