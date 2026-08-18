/**
 * Lossless, tolerant parser for the six-string ASCII tablatures described in
 * docs/ASCII-Guitar-Tablature.md. The source grid stays authoritative; the
 * semantic objects below are only a rendering/playback interpretation.
 */

export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type TuningKind = "standard" | "drop-d" | "unknown" | "conflicting";
export type NewlineKind = "lf" | "crlf" | "cr" | "mixed";

export interface TabDiagnostic {
  readonly severity: "info" | "warning";
  readonly code:
    | "unknown-symbol"
    | "unknown-tuning"
    | "conflicting-tuning"
    | "ambiguous-rhythm"
    | "assumed-encoding";
  readonly message: string;
  readonly line?: number;
}

export interface FretEvent {
  readonly id: string;
  readonly string: StringNumber;
  readonly fret: number;
  readonly harmonic: boolean;
  readonly raw: string;
  readonly onsetColumn: number;
  readonly endColumn: number;
  readonly sourceLine: number;
}

export interface TabTechnique {
  readonly kind: "hammer-on" | "pull-off" | "slide" | "sustain";
  readonly string: StringNumber;
  readonly fromColumn: number;
  readonly toColumn: number;
}

export interface TabGlyph {
  readonly raw: string;
  readonly column: number;
}

export interface TabRow {
  readonly string: StringNumber;
  readonly label?: string;
  readonly prefix: string;
  readonly raw: string;
  readonly body: string;
  readonly bodyStartColumn: number;
  readonly sourceLine: number;
  readonly events: readonly FretEvent[];
  readonly glyphs: readonly TabGlyph[];
}

export interface TabAnnotation {
  readonly kind: "beats" | "barre" | "fingering" | "direction" | "navigation";
  readonly raw: string;
  readonly sourceLine: number;
}

export interface TabBarline {
  readonly column: number;
  readonly repeat: boolean;
}

export interface TabSystem {
  readonly index: number;
  readonly rows: readonly [TabRow, TabRow, TabRow, TabRow, TabRow, TabRow];
  readonly barlines: readonly TabBarline[];
  readonly techniques: readonly TabTechnique[];
  readonly annotationsAbove: readonly TabAnnotation[];
  readonly annotationsBelow: readonly TabAnnotation[];
  readonly widthColumns: number;
  readonly startLine: number;
  readonly endLine: number;
}

export type TabSection =
  | { readonly kind: "prose"; readonly text: string; readonly startLine: number }
  | { readonly kind: "system"; readonly system: TabSystem };

export interface TabTuning {
  readonly kind: TuningKind;
  /** High string to low string, matching display rows. */
  readonly labels: readonly string[] | null;
}

export interface TabDocument {
  readonly sourceName: string;
  readonly title?: string;
  readonly rawText: string;
  readonly encoding: string;
  /** The encoding was inferred from the bytes, not declared by a BOM or header. */
  readonly encodingInferred: boolean;
  readonly newline: NewlineKind;
  readonly metadata: Readonly<Record<string, string>>;
  readonly meter?: string;
  readonly tuning: TabTuning;
  readonly sections: readonly TabSection[];
  readonly systems: readonly TabSystem[];
  readonly diagnostics: readonly TabDiagnostic[];
}

export interface DecodedAsciiTab {
  readonly text: string;
  readonly encoding: string;
  /** True when nothing declared this encoding and it was read out of the bytes. */
  readonly inferred: boolean;
  readonly newline: NewlineKind;
}

interface SourceInfo {
  readonly sourceName?: string;
  readonly encoding?: string;
  readonly encodingInferred?: boolean;
  readonly newline?: NewlineKind;
}

interface RowCandidate {
  readonly raw: string;
  readonly expanded: string;
  readonly prefix: string;
  readonly label?: string;
  readonly body: string;
  readonly letters: number;
  readonly fretTokens: number;
  readonly sourceLine: number;
}

interface DetectedSystem {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly candidates: readonly [
    RowCandidate,
    RowCandidate,
    RowCandidate,
    RowCandidate,
    RowCandidate,
    RowCandidate,
  ];
}

/**
 * Row openers seen across the archive (docs/ASCII-Guitar-Tablature.md §3.2 plus
 * the wider guitar-times corpus): `E-|`, `E|`, `E||`, `e:`, `E*`, `||`, `|*`,
 * `*|`, `|`. All are anchored, so a stray `D` inside prose can never pass for a
 * string label.
 */
const LABELED_BAR_PREFIX = /^(?<label>[EADGBeadgb])[ \t]?-?(?:\|\||\|\*|\*\||\||:|\*)/;
/** A labelled row whose staff starts straight after the letter, on a rule or on
 *  a fret: `E -----`, `E---`, `E 3-----`. */
const LABELED_STAFF_PREFIX = /^(?<label>[EADGBeadgb])[ \t]?(?=[-\d])/;
const UNLABELED_PREFIX = /^(?:\|\||\|\*|\*\||\|)/;
/**
 * A row that opens with neither a label nor a bar has only its shape to vouch
 * for it, so staff characters must dominate its body. Requiring two opening
 * hyphens instead — as this parser once did — silently dropped every
 * continuation system that begins on a fret (`-3---1---…`), which is most of
 * them: whole scores read as "no systems detected".
 */
const MIN_STAFF_RATIO = 0.5;
const TAB_URL = /\.txt$/i;
const MAX_BYTES = 1024 * 1024;
const MAX_LINES = 10_000;
const MAX_LINE_WIDTH = 2_048;

/** True for a tab text resource; URL query/hash fragments are ignored. */
export function isAsciiTabUrl(url: string): boolean {
  return TAB_URL.test(url.split(/[?#]/, 1)[0]);
}

/** Expand literal tabs to fixed tab stops without changing the stored source. */
export function expandTabs(line: string, tabSize = 8): string {
  let column = 0;
  let expanded = "";
  for (const character of line) {
    if (character !== "\t") {
      expanded += character;
      column += 1;
      continue;
    }
    const spaces = tabSize - (column % tabSize);
    expanded += " ".repeat(spaces);
    column += spaces;
  }
  return expanded;
}

/**
 * Byte-order marks are proof; everything else is evidence.
 *
 * The archive predates UTF-8: its scores were typed on Western European and
 * Russian DOS/Windows machines, so a single `\xb4` in "Dirk´s GuitarPage" was
 * enough to make a strict UTF-8 reader reject a whole tablature. The order
 * below refuses to guess before it has to — BOM, then a charset the server
 * declared, then strict UTF-8 — and only reaches for a legacy code page when
 * the bytes cannot be Unicode at all. Nothing is ever decoded with U+FFFD
 * replacement, which is what the spec (§8.1) forbids: a candidate either reads
 * cleanly or is not used.
 */
const BOMS: readonly { readonly bytes: readonly number[]; readonly encoding: string }[] = [
  { bytes: [0xef, 0xbb, 0xbf], encoding: "utf-8" },
  { bytes: [0xff, 0xfe], encoding: "utf-16le" },
  { bytes: [0xfe, 0xff], encoding: "utf-16be" },
];

/** Legacy code pages this archive actually contains, likeliest first — the
 *  order is also the tie-break, so it is not arbitrary. */
const LEGACY_ENCODINGS = [
  "windows-1252", // Western European: the bulk of the corpus (é ñ ó ´ ° ½)
  "windows-1251", // Cyrillic, Windows
  "koi8-r", // Cyrillic, Unix/Usenet
  "ibm866", // Cyrillic, DOS
  "iso-8859-2", // Central European
] as const;

const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
/** Punctuation and signs a musician really types: quotes, dashes, degrees,
 *  fractions, accents, currency. */
const TYPOGRAPHY = /[¡-¿×÷‐-›€™]/;
/** Box-drawing and blocks — what a Cyrillic page makes of Western punctuation. */
const BOX_DRAWING = /[─-▟]/;
const WORDS = /\p{L}+/gu;
/** Three or more adjacent non-ASCII Latin letters: Cyrillic read the wrong way. */
const ACCENTED_RUN = /(?:(?=\P{ASCII})\p{Script=Latin}){3,}/gu;
const CYRILLIC_RUN = /\p{Script=Cyrillic}{2,}/gu;

/**
 * Tolerant byte decoding with the small resource limits required by the spec.
 * `declaredCharset` is whatever the transport claimed (an HTTP `Content-Type`
 * charset); it is tried, not trusted.
 */
export function decodeAsciiTab(buffer: ArrayBuffer, declaredCharset?: string): DecodedAsciiTab {
  if (!buffer.byteLength) throw new Error("The tablature file is empty.");
  if (buffer.byteLength > MAX_BYTES) throw new Error("The tablature file is too large.");

  const raw = new Uint8Array(buffer);

  const bom = BOMS.find((candidate) => candidate.bytes.every((byte, i) => raw[i] === byte));
  if (bom) {
    const text = tryDecode(raw.subarray(bom.bytes.length), bom.encoding);
    if (text === null) {
      throw new Error(`The tablature carries a ${bom.encoding.toUpperCase()} byte-order mark but is not valid ${bom.encoding.toUpperCase()} text.`);
    }
    return decoded(text, bom.encoding, false);
  }

  // UTF-16 with the mark stripped somewhere along the way: half the bytes are
  // NUL, always on the same parity. Checked before the padding trim below,
  // which would otherwise eat the NUL of a final character.
  const wide = detectBomlessUtf16(raw);
  if (wide) {
    const text = tryDecode(raw, wide);
    if (text !== null) return decoded(text, wide, true);
  }

  // DOS editors ended a file with ^Z, and some archives pad with NULs.
  const bytes = trimTrailingPadding(raw);
  if (!bytes.length) throw new Error("The tablature file is empty.");

  const declared = normalizeCharset(declaredCharset);
  if (declared) {
    const text = tryDecode(bytes, declared);
    if (text !== null) return decoded(text, declared, false);
  }

  const utf8 = tryDecode(bytes, "utf-8");
  if (utf8 !== null) return decoded(utf8, "utf-8", false);

  // Not Unicode. Read it through every plausible code page and keep the one
  // whose result looks like language rather than mojibake.
  let best: { text: string; encoding: string; score: number } | null = null;
  for (const encoding of LEGACY_ENCODINGS) {
    const text = tryDecode(bytes, encoding);
    if (text === null) continue;
    const score = scoreLegacyText(text);
    if (!best || score > best.score) best = { text, encoding, score };
  }
  if (!best) throw new Error("The tablature is not text in any encoding this reader knows.");
  return decoded(best.text, best.encoding, true);
}

function decoded(text: string, encoding: string, inferred: boolean): DecodedAsciiTab {
  return { text, encoding, inferred, newline: detectNewline(text) };
}

/** A reading, or null when these bytes are not that encoding (or it is unknown). */
function tryDecode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function trimTrailingPadding(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x1a || bytes[end - 1] === 0x00)) end -= 1;
  return end === bytes.length ? bytes : bytes.subarray(0, end);
}

function detectBomlessUtf16(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  const sample = Math.min(bytes.length, 4096) & ~1;
  if (sample < 16) return null;
  let evenNul = 0;
  let oddNul = 0;
  for (let i = 0; i < sample; i += 2) {
    if (bytes[i] === 0) evenNul += 1;
    if (bytes[i + 1] === 0) oddNul += 1;
  }
  const pairs = sample / 2;
  if (oddNul > pairs * 0.6 && evenNul < pairs * 0.05) return "utf-16le";
  if (evenNul > pairs * 0.6 && oddNul < pairs * 0.05) return "utf-16be";
  return null;
}

/** A transport charset, reduced to a label `TextDecoder` may accept. */
function normalizeCharset(value: string | undefined): string | null {
  const label = value?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  return label && /^[a-z\d][a-z\d._:-]*$/.test(label) ? label : null;
}

/**
 * How much a candidate reading looks like language rather than mojibake.
 *
 * Only non-ASCII characters carry any signal — every candidate agrees about
 * the ASCII bytes, which are the overwhelming majority of a tablature — and
 * the three shapes below are what actually separate these code pages:
 *
 *   • a word mixing alphabets ("Dirkґs") is nobody's writing;
 *   • a run of accented Latin letters is Cyrillic read through a Western page;
 *   • box-drawing pieces are Western punctuation read through a Cyrillic one.
 */
function scoreLegacyText(text: string): number {
  let score = 0;

  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code < 0x80) continue;
    if (code <= 0x9f) score -= 20; // a C1 control is never text
    else if (LATIN.test(character) || CYRILLIC.test(character)) score += 3;
    else if (TYPOGRAPHY.test(character)) score += 2;
    else if (BOX_DRAWING.test(character)) score -= 4;
    else score -= 1;
  }

  for (const [word] of text.matchAll(WORDS)) {
    if (LATIN.test(word) && CYRILLIC.test(word)) score -= 25;
  }
  for (const [run] of text.matchAll(ACCENTED_RUN)) score -= 8 * (run.length - 2);
  for (const [run] of text.matchAll(CYRILLIC_RUN)) score += 2 * run.length;

  return score;
}

export function parseAsciiTab(text: string, source: SourceInfo = {}): TabDocument {
  const normalized = text.replace(/\r\n?|\n/g, "\n");
  const rawLines = normalized.split("\n");
  if (rawLines.length > MAX_LINES) throw new Error("The tablature has too many lines.");
  if (rawLines.some((line) => expandTabs(line).length > MAX_LINE_WIDTH)) {
    throw new Error("The tablature contains an excessively wide line.");
  }

  const detected = detectSystems(rawLines);
  const annotationLines = new Set<number>();
  const diagnostics: TabDiagnostic[] = [];
  const systems = detected.map((item, index) => {
    const above = findAnnotations(rawLines, item.startIndex, -1, annotationLines);
    const below = findAnnotations(rawLines, item.endIndex, 1, annotationLines);
    const rows = item.candidates.map((candidate, rowIndex) =>
      parseRow(candidate, (rowIndex + 1) as StringNumber, index),
    ) as unknown as TabSystem["rows"];
    const techniques = rows.flatMap(techniquesForRow);
    const glyphs = rows.reduce((count, row) => count + row.glyphs.length, 0);
    if (glyphs) {
      diagnostics.push({
        severity: "warning",
        code: "unknown-symbol",
        message: `${glyphs} source symbol${glyphs === 1 ? "" : "s"} could not be interpreted and remain visible.`,
        line: item.startIndex + 1,
      });
    }
    return {
      index,
      rows,
      techniques,
      barlines: findBarlines(rows),
      annotationsAbove: above,
      annotationsBelow: below,
      widthColumns: Math.max(...rows.map((row) => row.body.length)),
      startLine: item.startIndex + 1,
      endLine: item.endIndex + 1,
    } satisfies TabSystem;
  });

  const tuning = detectTuning(rawLines, systems);
  if (tuning.kind === "unknown") {
    diagnostics.unshift({
      severity: "warning",
      code: "unknown-tuning",
      message: "The source does not declare a reliable tuning; graphical positions are preserved.",
    });
  } else if (tuning.kind === "conflicting") {
    diagnostics.unshift({
      severity: "warning",
      code: "conflicting-tuning",
      message: "The source contains conflicting standard and drop-D tuning evidence.",
    });
  }
  diagnostics.push({
    severity: "info",
    code: "ambiguous-rhythm",
    message: "Rhythm is inferred from source spacing and is not authoritative.",
  });
  if (source.encodingInferred) {
    diagnostics.unshift({
      severity: "info",
      code: "assumed-encoding",
      message: `The file declares no encoding; it was read as ${(source.encoding ?? "utf-8").toUpperCase()} because that reading is the only one that spells words.`,
    });
  }
  const metadata = parseMetadata(rawLines);

  return {
    sourceName: source.sourceName ?? "tablature.txt",
    title: detectTitle(rawLines, metadata),
    rawText: text,
    encoding: source.encoding ?? "utf-8",
    encodingInferred: source.encodingInferred ?? false,
    newline: source.newline ?? detectNewline(text),
    metadata,
    meter: detectMeter(text),
    tuning,
    sections: buildSections(rawLines, systems, annotationLines),
    systems,
    diagnostics,
  };
}

function detectNewline(text: string): NewlineKind {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const withoutCrlf = text.replace(/\r\n/g, "");
  const lf = (withoutCrlf.match(/\n/g) ?? []).length;
  const cr = (withoutCrlf.match(/\r/g) ?? []).length;
  const kinds = Number(crlf > 0) + Number(lf > 0) + Number(cr > 0);
  if (kinds > 1) return "mixed";
  if (crlf) return "crlf";
  if (cr) return "cr";
  return "lf";
}

function detectSystems(lines: readonly string[]): DetectedSystem[] {
  const systems: DetectedSystem[] = [];
  for (let start = 0; start <= lines.length - 6; ) {
    const candidates = Array.from({ length: 6 }, (_, row) => rowCandidate(lines[start + row], start + row + 1));
    if (candidates.every((candidate): candidate is RowCandidate => candidate !== null)) {
      const widths = candidates.map((candidate) => candidate.expanded.length);
      const widthSpread = Math.max(...widths) - Math.min(...widths);
      const letters = candidates.reduce((sum, candidate) => sum + candidate.letters, 0);
      const frets = candidates.reduce((sum, candidate) => sum + candidate.fretTokens, 0);
      if (widthSpread <= 24 && letters <= 30 && frets > 0) {
        systems.push({
          startIndex: start,
          endIndex: start + 5,
          candidates: candidates as unknown as DetectedSystem["candidates"],
        });
        start += 6;
        continue;
      }
    }
    start += 1;
  }
  return systems;
}

function rowCandidate(raw: string, sourceLine: number): RowCandidate | null {
  const expanded = expandTabs(raw);
  const labeledBar = LABELED_BAR_PREFIX.exec(expanded);
  const labeledStaff = labeledBar ? null : LABELED_STAFF_PREFIX.exec(expanded);
  const labeled = labeledBar ?? labeledStaff;
  const unlabeled = labeled ? null : UNLABELED_PREFIX.exec(expanded);
  const continuation = !labeled && !unlabeled && /^[-\d]/.test(expanded);
  if (!labeled && !unlabeled && !continuation) return null;
  if ((expanded.match(/[-|:]/g) ?? []).length < 4) return null;

  const prefix = labeled?.[0] ?? unlabeled?.[0] ?? "";
  const body = expanded.slice(prefix.length);
  // A bar is evidence in itself. A row opening on a bare hyphen — or on a
  // letter with nothing but staff behind it — has to earn its place, or every
  // prose line that starts with a dash would join a system.
  if ((continuation || labeledStaff) && staffRatio(body) < MIN_STAFF_RATIO) return null;
  return {
    raw,
    expanded,
    prefix,
    label: labeled?.groups?.label,
    body,
    letters: (body.match(/[A-Za-z]/g) ?? []).length,
    fretTokens: (body.match(/\d+/g) ?? []).length,
    sourceLine,
  };
}

/**
 * One fret token, with any technique marker written against it folded in:
 * `r(5` (this archive's pizzicato), `<12>` (harmonic), and a plain fret which
 * may carry a leading `t` (tremolo), `h`/`p`/`poff`/`pulloff`, `s` or `b`.
 *
 * Folding the marker into the token is what rescues a whole voice: the tremolo
 * scores write their top line as `t12-t12-t12`, and a fret whose neighbour was
 * an unrecognised letter used to be discarded — `El Ultimo Tremolo` lost every
 * tremolo note it is named for. The marker is *not* part of `onsetColumn`,
 * which still points at the first digit, so technique detection between two
 * events reads exactly the same span as before.
 */
const TOKEN_RE = () => /r\((\d+)|<(\d+)>|((?:pulloff|poff|[hprtsb])?)(\d+)/gi;

/** Letters that may touch a fret token without disproving it. */
const TECHNIQUE_LETTER = /[hprtsb]/i;

/** Above this a "fret" is not a guitar position but a misread token. */
const MAX_FRET = 36;
/** The highest fret a *packed* two-digit reading may claim (a 20-fret classical
 *  guitar plus headroom); beyond it the two digits are two separate notes. */
const PACKED_MAX_FRET = 24;

/**
 * A run of digits, read as the frets a player would see.
 *
 * Two digits can be one fret (`12`), so a run cannot simply be read digit by
 * digit — but the tightly packed scores also write fast notes with no room
 * between them, and `--1412109-` is 14 12 10 9, not one impossible fret. Read
 * greedily: take two digits whenever they make a real position, otherwise one.
 * Runs of one or two digits keep their old, unambiguous reading.
 */
function splitFretRun(run: string): { readonly text: string; readonly fret: number; readonly at: number }[] {
  if (run.length <= 2) return [{ text: run, fret: Number(run), at: 0 }];
  const pieces: { text: string; fret: number; at: number }[] = [];
  for (let at = 0; at < run.length; ) {
    const pair = run.slice(at, at + 2);
    const wide = pair.length === 2 && Number(pair) >= 10 && Number(pair) <= PACKED_MAX_FRET;
    const text = wide ? pair : run[at];
    pieces.push({ text, fret: Number(text), at });
    at += text.length;
  }
  return pieces;
}

/** Share of a row body that is staff rule rather than prose. */
function staffRatio(body: string): number {
  const trimmed = body.trimEnd();
  if (!trimmed) return 0;
  return (trimmed.match(/[-|=]/g) ?? []).length / trimmed.length;
}

function parseRow(candidate: RowCandidate, string: StringNumber, systemIndex: number): TabRow {
  const body = candidate.body;
  const consumed = Array.from({ length: body.length }, () => false);
  const events: FretEvent[] = [];
  const token = TOKEN_RE();
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    const raw = match[0];
    const start = match.index;
    const run = match[4];
    const claim = () => {
      for (let i = start; i < start + raw.length; i++) consumed[i] = true;
    };
    const add = (fret: number, text: string, onsetColumn: number, endColumn: number, harmonic: boolean) => {
      events.push({
        id: `s${systemIndex}-r${string}-c${onsetColumn}`,
        string,
        fret,
        harmonic,
        raw: text,
        onsetColumn,
        endColumn,
        sourceLine: candidate.sourceLine,
      });
    };

    // `r(5` and `<12>` name their own extent, so they stay one event written
    // exactly as the source wrote them.
    if (run === undefined) {
      const fret = Number(match[1] ?? match[2]);
      if (!Number.isFinite(fret) || fret > MAX_FRET) continue;
      claim();
      add(fret, raw, start + raw.search(/\d/), start + raw.length, match[2] !== undefined);
      continue;
    }

    const marker = match[3] ?? "";
    if (!isPlausibleFret(body, start, raw.length, marker)) continue;
    const pieces = splitFretRun(run);
    if (pieces.some((piece) => !Number.isFinite(piece.fret) || piece.fret > MAX_FRET)) continue;
    const runStart = start + (match[3]?.length ?? 0);
    claim();
    for (const piece of pieces) {
      add(piece.fret, piece.text, runStart + piece.at, runStart + piece.at + piece.text.length, false);
    }
  }

  markStructuralCharacters(body, consumed, events);
  const glyphs: TabGlyph[] = [];
  for (let column = 0; column < body.length; column++) {
    if (!consumed[column] && body[column] !== " ") glyphs.push({ raw: body[column], column });
  }
  return {
    string,
    label: candidate.label,
    prefix: candidate.prefix,
    raw: candidate.raw,
    body,
    bodyStartColumn: candidate.prefix.length,
    sourceLine: candidate.sourceLine,
    events,
    glyphs,
  };
}

/** Staff punctuation that may sit against a fret token. */
const STRUCTURAL_NEIGHBOUR = /[-|:=<>/\\()hprtsb{]/i;

function isPlausibleFret(body: string, start: number, width: number, marker = ""): boolean {
  const before = body[start - 1];
  const after = body[start + width];
  if (before && /[A-Za-z]/.test(before) && !TECHNIQUE_LETTER.test(before)) return false;
  if (after && /[A-Za-z]/.test(after) && !TECHNIQUE_LETTER.test(after)) return false;
  // A technique marker written against the digits already says this is a fret;
  // without one, a neighbour has to be staff punctuation rather than prose.
  if (marker) return true;
  return start === 0 || STRUCTURAL_NEIGHBOUR.test(before ?? "") || STRUCTURAL_NEIGHBOUR.test(after ?? "");
}

function markStructuralCharacters(body: string, consumed: boolean[], events: readonly FretEvent[]): void {
  for (let i = 0; i < body.length; i++) {
    if (/[-|:*]/.test(body[i])) consumed[i] = true;
  }
  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i];
    const to = events[i + 1];
    const between = body.slice(from.endColumn, to.onsetColumn);
    if (/^(?:[-=\s]*(?:h|p|poff|pulloff|s|\/|\\)[-=\s]*)$/i.test(between)) {
      for (let column = from.endColumn; column < to.onsetColumn; column++) consumed[column] = true;
    }
  }
  for (const event of events) {
    let column = event.endColumn;
    while (body[column] === "=") consumed[column++] = true;
  }
}

function techniquesForRow(row: TabRow): TabTechnique[] {
  const techniques: TabTechnique[] = [];
  for (let i = 0; i < row.events.length - 1; i++) {
    const from = row.events[i];
    const to = row.events[i + 1];
    const connector = row.body.slice(from.endColumn, to.onsetColumn);
    const kind = /pulloff|poff|p/i.test(connector)
      ? "pull-off"
      : /h/i.test(connector)
        ? "hammer-on"
        : /[/\\s]/i.test(connector)
          ? "slide"
          : null;
    if (kind) techniques.push({ kind, string: row.string, fromColumn: from.onsetColumn, toColumn: to.onsetColumn });
  }
  for (const event of row.events) {
    let end = event.endColumn;
    while (row.body[end] === "=") end += 1;
    if (end > event.endColumn) {
      techniques.push({ kind: "sustain", string: row.string, fromColumn: event.endColumn, toColumn: end });
    }
  }
  return techniques;
}

function findBarlines(rows: TabSystem["rows"]): TabBarline[] {
  const columns = new Map<number, number>();
  for (const row of rows) {
    for (let column = 0; column < row.body.length; column++) {
      if (row.body[column] === "|") columns.set(column, (columns.get(column) ?? 0) + 1);
    }
  }
  return [...columns.entries()]
    .filter(([, count]) => count >= 4)
    .map(([column]) => ({
      column,
      repeat: rows.some((row) => row.body[column - 1] === "*" || row.body[column + 1] === "*"),
    }))
    .sort((a, b) => a.column - b.column);
}

function findAnnotations(
  lines: readonly string[],
  boundaryIndex: number,
  direction: -1 | 1,
  consumed: Set<number>,
): TabAnnotation[] {
  let index = boundaryIndex + direction;
  if (direction === -1 && lines[index]?.trim() === "") index -= 1;
  const found: TabAnnotation[] = [];
  while (index >= 0 && index < lines.length && found.length < 4) {
    const annotation = classifyAnnotation(lines[index], index + 1);
    if (!annotation) break;
    consumed.add(index);
    found.push(annotation);
    index += direction;
  }
  return direction === -1 ? found.reverse() : found;
}

function classifyAnnotation(raw: string, sourceLine: number): TabAnnotation | null {
  const text = expandTabs(raw);
  const trimmed = text.trim();
  if (!trimmed) return null;
  // A beat ruler is bars and, in many files, a dot on the off-beat between
  // them: `    |   .   |   .   |`.
  if (/^[|*.\s]+$/.test(text) && (text.match(/\|/g) ?? []).length >= 2) {
    return { kind: "beats", raw: text, sourceLine };
  }
  if (/\bC\d+\s*-+/i.test(text)) return { kind: "barre", raw: text, sourceLine };
  if (/^[\s\d-]+$/.test(text) && /\d/.test(text)) return { kind: "fingering", raw: text, sourceLine };
  if (/^(?:\s*[%$]\s*|.*\b(?:to coda|d\.?s\.?|fine|ending|second part)\b.*)$/i.test(text)) {
    return { kind: "navigation", raw: text, sourceLine };
  }
  if (/\b(?:allegro|expressivo|harmonics?|oct\.|tempo)\b/i.test(text)) {
    return { kind: "direction", raw: text, sourceLine };
  }
  return null;
}

function detectTuning(lines: readonly string[], systems: readonly TabSystem[]): TabTuning {
  const evidence = new Set<"standard" | "drop-d">();
  const text = lines.join("\n");

  // A written-out tuning outranks everything else in the file.
  const declared = DECLARED_TUNING.exec(text)?.[1].replace(/\s+/g, "").toUpperCase();
  if (declared && declared !== "EADGBE" && declared !== "DADGBE") {
    // An open tuning (DGDGBE and friends). Saying "drop D" here would put every
    // sounded pitch on the wrong string, so the honest answer is "unknown".
    return { kind: "unknown", labels: null };
  }
  if (declared === "EADGBE") evidence.add("standard");
  if (declared === "DADGBE") evidence.add("drop-d");
  if (DROP_D_PROSE.test(text)) evidence.add("drop-d");

  for (let start = 0; start <= lines.length - 6; start++) {
    const joined = lines
      .slice(start, start + 6)
      .map((line) => rowLabel(line) ?? "")
      .join("");
    if (joined === "EBGDAE") evidence.add("standard");
    if (joined === "EBGDAD") evidence.add("drop-d");
  }

  const firstLabels = systems[0]?.rows.map((row) => row.label?.toUpperCase()).join("");
  const preferred = firstLabels === "EBGDAD" ? "drop-d" : firstLabels === "EBGDAE" ? "standard" : undefined;
  if (evidence.size > 1) {
    return {
      kind: "conflicting",
      labels: preferred === "drop-d" ? DROP_D_LABELS : preferred === "standard" ? STANDARD_LABELS : null,
    };
  }
  const kind = evidence.values().next().value as "standard" | "drop-d" | undefined;
  if (!kind) return { kind: "unknown", labels: null };
  return { kind, labels: kind === "drop-d" ? DROP_D_LABELS : STANDARD_LABELS };
}

/** The six open strings written low to high after a `Tuning:`-style key, in any
 *  spelling the archive uses (`Tuning: DADGBE`, `Stimmung : E A D G B E`,
 *  `Tuning Standard: EADGBE`). */
const DECLARED_TUNING = /(?:\btuning|\bstimmung|\baccordatura|\bafinaci[oó]n)[^:\n]*:[^\S\n]*([EADGBeadgb](?:[^\S\n]*[EADGBeadgb]){5})(?![^\S\n]*[A-Za-z])/i;

/** Prose that drops the sixth string: `Tune the 6th string to D`, `6th string:
 *  tuned to D`, `D tuning`, `drop-D`. */
const DROP_D_PROSE = /\bdrop(?:ped)?[-\s]?d\b|\bd\s+tuning\b|\b6th\s+string\b[^.\n]{0,32}\bto\s+d\b/i;

/** The string this line labels itself with, if it opens like a staff row. */
function rowLabel(line: string): string | undefined {
  const expanded = expandTabs(line);
  const match = LABELED_BAR_PREFIX.exec(expanded) ?? LABELED_STAFF_PREFIX.exec(expanded);
  return match?.groups?.label?.toUpperCase();
}

const STANDARD_LABELS = ["E", "B", "G", "D", "A", "E"] as const;
const DROP_D_LABELS = ["E", "B", "G", "D", "A", "D"] as const;

function parseMetadata(lines: readonly string[]): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {};
  const pattern = /^\s*(Title|Author|Subject|From|Key|Key Signature|Time Signature|Takt|Stimmung|Tuning|Tabbed by|Tablature by|Transcription by|Composer|Capo)\s*:\s*(.*?)\s*$/i;
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match?.[2]) metadata[match[1]] = match[2];
  }
  return metadata;
}

function detectTitle(lines: readonly string[], metadata: Readonly<Record<string, string>>): string | undefined {
  const declared = Object.entries(metadata).find(([key]) => key.toLowerCase() === "title")?.[1];
  if (declared) return declared;
  for (const raw of lines.slice(0, 40)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.length > 120) continue;
    if (/^(?:date|from|to|subject|author|composer|tabbed by|tablature by|transcription by|key|time signature|takt|stimmung|tuning|capo|attention)\s*:/i.test(line)) continue;
    if (/^(?:https?:\/\/|www\.)|@/.test(line)) continue;
    if (/^(?:[EADGBe]-?(?:\|\||\||:)|\|{1,2}|-{2})/.test(line)) continue;
    if (/\p{L}/u.test(line)) return line;
  }
  return undefined;
}

function detectMeter(text: string): string | undefined {
  const declared = /(?:time signature|takt)\s*:\s*(\d+\s*\/\s*\d+)/i.exec(text)?.[1];
  const prose = /\b(\d+\s*\/\s*\d+)\s*(?:time|timing)\b/i.exec(text)?.[1];
  return (declared ?? prose)?.replace(/\s/g, "");
}

function buildSections(
  lines: readonly string[],
  systems: readonly TabSystem[],
  annotations: ReadonlySet<number>,
): TabSection[] {
  const byStart = new Map(systems.map((system) => [system.startLine - 1, system]));
  const sections: TabSection[] = [];
  let prose: string[] = [];
  let proseStart = 0;
  const flush = () => {
    if (prose.length) sections.push({ kind: "prose", text: prose.join("\n"), startLine: proseStart + 1 });
    prose = [];
  };

  for (let index = 0; index < lines.length; ) {
    const system = byStart.get(index);
    if (system) {
      flush();
      sections.push({ kind: "system", system });
      index = system.endLine;
      proseStart = index;
      continue;
    }
    if (annotations.has(index)) {
      flush();
      index += 1;
      proseStart = index;
      continue;
    }
    if (!prose.length) proseStart = index;
    prose.push(lines[index]);
    index += 1;
  }
  flush();
  return sections;
}
