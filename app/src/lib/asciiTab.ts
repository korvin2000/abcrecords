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
    | "ambiguous-rhythm";
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
  readonly newline: NewlineKind;
}

interface SourceInfo {
  readonly sourceName?: string;
  readonly encoding?: string;
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

const LABELED_PREFIX = /^(?<label>[EADGBe])-?(?:\|\||\||:)/;
const UNLABELED_PREFIX = /^(?:\|\||\|\*?|\|)/;
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

/** Strict byte decoding with the small resource limits required by the spec. */
export function decodeAsciiTab(buffer: ArrayBuffer): DecodedAsciiTab {
  if (!buffer.byteLength) throw new Error("The tablature file is empty.");
  if (buffer.byteLength > MAX_BYTES) throw new Error("The tablature file is too large.");

  const bytes = new Uint8Array(buffer);
  let encoding = "utf-8";
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    offset = 2;
  }

  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
  } catch {
    throw new Error("The tablature is not valid UTF-8 or BOM-marked UTF-16 text.");
  }
  return { text, encoding, newline: detectNewline(text) };
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
  const metadata = parseMetadata(rawLines);

  return {
    sourceName: source.sourceName ?? "tablature.txt",
    title: detectTitle(rawLines, metadata),
    rawText: text,
    encoding: source.encoding ?? "utf-8",
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
  const labeled = LABELED_PREFIX.exec(expanded);
  const unlabeled = labeled ? null : UNLABELED_PREFIX.exec(expanded);
  const continuation = !labeled && !unlabeled && /^-{2,}/.test(expanded);
  if (!labeled && !unlabeled && !continuation) return null;
  if ((expanded.match(/[-|:]/g) ?? []).length < 4) return null;

  const prefix = labeled?.[0] ?? unlabeled?.[0] ?? "";
  const body = expanded.slice(prefix.length);
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

function parseRow(candidate: RowCandidate, string: StringNumber, systemIndex: number): TabRow {
  const body = candidate.body;
  const consumed = Array.from({ length: body.length }, () => false);
  const events: FretEvent[] = [];
  const token = /r\((\d+)|<(\d+)>|(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    const raw = match[0];
    const start = match.index;
    if (match[3] && !isPlausibleFret(body, start, raw.length)) continue;
    const fret = Number(match[1] ?? match[2] ?? match[3]);
    if (!Number.isFinite(fret) || fret > 36) continue;
    for (let i = start; i < start + raw.length; i++) consumed[i] = true;
    events.push({
      id: `s${systemIndex}-r${string}-c${start}`,
      string,
      fret,
      harmonic: match[2] !== undefined,
      raw,
      onsetColumn: start + raw.search(/\d/),
      endColumn: start + raw.length,
      sourceLine: candidate.sourceLine,
    });
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

function isPlausibleFret(body: string, start: number, width: number): boolean {
  const before = body[start - 1];
  const after = body[start + width];
  if (before && /[A-Za-z]/.test(before) && !/[hHpPrR]/.test(before)) return false;
  if (after && /[A-Za-z]/.test(after) && !/[hHpPrR]/.test(after)) return false;
  return start === 0 || /[-|:=<>/()hpHP{]/.test(before ?? "") || /[-|:=<>/()hpHP{]/.test(after ?? "");
}

function markStructuralCharacters(body: string, consumed: boolean[], events: readonly FretEvent[]): void {
  for (let i = 0; i < body.length; i++) {
    if (/[-|:*]/.test(body[i])) consumed[i] = true;
  }
  for (let i = 0; i < events.length - 1; i++) {
    const from = events[i];
    const to = events[i + 1];
    const between = body.slice(from.endColumn, to.onsetColumn);
    if (/^(?:[-=\s]*(?:h|p|poff|pulloff|\/)[-=\s]*)$/i.test(between)) {
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
        : /\//.test(connector)
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
  if (/^[|*\s]+$/.test(text) && (text.match(/\|/g) ?? []).length >= 2) {
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
  if (/6th\s+string\s*:\s*tuned\s+to\s+D/i.test(text) || /\bD\s+tuning\b/i.test(text)) evidence.add("drop-d");
  if (/Stimmung\s*:\s*E\s+A\s+D\s+G\s+B\s+E/i.test(text)) evidence.add("standard");

  for (let start = 0; start <= lines.length - 6; start++) {
    const labels = lines.slice(start, start + 6).map((line) => /([EADGBe])-?(?:\|\||\||:)/.exec(line)?.[1].toUpperCase());
    const joined = labels.join("");
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
