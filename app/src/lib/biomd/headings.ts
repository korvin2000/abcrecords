import { fold } from "../search/fold";

/**
 * Who names an open entry: the dossier, or the article's own `# ` line(s).
 *
 * The codex plate and the article are two places one name can be printed, and
 * printing it twice is the failure mode this module exists to avoid — while
 * still never losing a title that says something the plate does not.
 *
 * The rule, in one sentence: **the dossier names the entry when it can, the
 * article's title lines name it when it cannot, and a title line the plate
 * already carries is not printed a second time.**
 */

export interface HeadingPlan {
  /** First line of the codex plate. */
  title: string;
  /** Second line of the plate — a surname, or the document's second `# `. */
  secondary?: string;
  /** Title lines the article must still print, because the plate says
   *  something else. Empty in the ordinary case. */
  articleTitles: readonly string[];
}

/**
 * @param docTitles  the document's `# ` lines (`BioDoc.titles`, at most two)
 * @param name       what the dossier edition knows: given name and surname
 * @param fallback   the catalogue's localized name, used when nothing else names the entry
 */
export function planHeadings(
  docTitles: readonly string[],
  name: { title?: string | null; secondary?: string | null },
  fallback: string,
): HeadingPlan {
  const title = name.title?.trim() ?? "";
  const secondary = name.secondary?.trim() ?? "";

  // Nothing authored: the article's own lines are the name, and a document
  // that spells it over two of them fills both lines of the plate. Having been
  // promoted, they are not printed again below.
  if (!title) {
    return {
      title: docTitles[0] || fallback,
      secondary: docTitles[1] || secondary || undefined,
      articleTitles: [],
    };
  }

  const plate = [title, secondary].filter(Boolean).join(" ");
  return {
    title,
    secondary: secondary || undefined,
    // A line the plate already carries would be a repetition; one that carries
    // different information is content, and belongs in the article.
    articleTitles: docTitles.filter((line) => !isSameName(line, plate)),
  };
}

/** At and above this the two texts are taken to name the same thing. */
const SAME_NAME = 0.95;

/**
 * Do these two texts name the same thing?
 *
 * Similarity is the overlap of their words against the *shorter* of the two,
 * which is what makes the comparison forgiving in the one direction that
 * matters: a plate reading "Агустин · Барриос" and a title line reading
 * "Агустин Барриос Мангоре" are the same man, as are "Федерико" and "Федерико
 * Гарсиа Лорка", while "Аудио-карта" over a name shares nothing and scores 0.
 * Word order, punctuation, case and Latin diacritics are all normalized away
 * (the same `fold` the search agrees on), so only the words themselves count.
 */
export function nameSimilarity(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (!left.length || !right.length) return 0;

  const pool = [...right];
  let shared = 0;
  for (const word of left) {
    const exact = pool.indexOf(word);
    const at = exact >= 0 ? exact : pool.findIndex((other) => nearlyEqual(other, word));
    if (at >= 0) {
      pool.splice(at, 1); // each word answers for one word, so "Иван Иван" ≠ "Иван"
      shared++;
    }
  }
  return shared / Math.min(left.length, right.length);
}

/**
 * The same word to within one letter.
 *
 * A dossier and an article are written by hand, years apart, from names that
 * reached Russian through transliteration — "Френсис"/"Франсис",
 * "Гарсиа"/"Гарсия". Those are one spelling, not two names, and the plate
 * should not be repeated below just because of the vowel. Under four letters
 * an edit is too much of the word to forgive.
 *
 * A prefix/suffix scan rather than an edit-distance matrix: at a budget of one
 * edit the two must agree everywhere except at a single point, which is exactly
 * what the two scans meeting means.
 */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.max(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let head = 0;
  while (head < short.length && short[head] === long[head]) head++;
  let tail = 0;
  while (tail < short.length - head && short[short.length - 1 - tail] === long[long.length - 1 - tail]) {
    tail++;
  }
  // A substitution leaves one letter uncovered; an insertion covers everything.
  return head + tail >= short.length - (a.length === b.length ? 1 : 0);
}

export function isSameName(a: string, b: string): boolean {
  return nameSimilarity(a, b) >= SAME_NAME;
}

/** Comparable words: folded, and split on everything that is not a letter or
 *  digit — so "Гарсиа-Лорка", "Гарсиа Лорка" and "ГАРСИА, ЛОРКА" agree. */
function words(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
