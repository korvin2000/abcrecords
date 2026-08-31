/**
 * BioMD Lite parser (docs/Biography-Markup.md, v1.6).
 *
 * BioMD = plain Markdown + `::: name … :::` layout/media blocks:
 *   lead · align · image · images · document · columns · column · nav · frame ·
 *   signature · anchor
 *
 * The whole grammar lives in one table (`BLOCKS`). Each directive declares the
 * properties it documents, whether it is a leaf, which child kinds it refuses
 * (spec 4.1), and how to build its node — so adding a directive means adding
 * one entry, and no other function in this file has to know about it.
 *
 * Engine rules honoured here (spec 17):
 *  - source order is logical reading order — the tree preserves it;
 *  - content is never deleted: an unknown block, an undeclared property and a
 *    misplaced child each keep their readable text, with a warning;
 *  - a missing closing fence is tolerated (the block runs to EOF, warned);
 *  - metadata never comes from the article — this parses layout/text only.
 */

import { anchorName } from "./anchors";

export type ImagePosition = "left" | "right" | "center" | "full";
export type ImageSize = "small" | "medium" | "large" | "full";
/** `::: align` — how a bounded group of content is aligned (spec 13). */
export type ContentAlignment = "left" | "center" | "right";
/** `frame:` — theme-named picture frame around an image (spec 6.5). */
export type ImageFrame = "curl" | "none" | "mat" | "black" | "white" | "red" | "gold";
/** `::: frame` — palette token of a bordered notice (spec 11). Not a picture frame. */
export type FrameTone = "gold" | "black" | "red" | "white";
/** Grid tracks of an `::: images` / `::: columns` block (`columns:`, spec 7, 9.1). */
export type Tracks = 1 | 2 | 3 | 4;

export interface ImageNode {
  kind: "image";
  src: string;
  position: ImagePosition;
  size: ImageSize;
  caption?: string;
  /** Accessibility text; the renderer falls back to `caption` when absent. */
  alt?: string;
  /** Click target of a thumbnail/cover/scan; executable schemes are dropped. */
  link?: string;
  /** Frame treatment; undefined = the theme default (Lifted Curl). */
  frame?: ImageFrame;
  /** Name of an `::: anchor` that introduces this picture inside an
   *  `::: images` group. The group is a grid, so the marker binds to the cell
   *  instead of claiming one of its own (spec 19). */
  anchor?: string;
}

export interface MarkdownNode {
  kind: "markdown";
  text: string;
}

export interface LeadNode {
  kind: "lead";
  children: BioNode[];
}

export interface AlignNode {
  kind: "align";
  /** null when `position` was missing or unknown — render at default alignment. */
  position: ContentAlignment | null;
  children: BioNode[];
}

export interface NavNode {
  kind: "nav";
  title?: string;
  /** Plain-text label of the current item; rendered as current, not clickable. */
  active?: string;
  /** The link list, kept as Markdown — the renderer reuses the Markdown pipeline. */
  markdown: string;
}

export interface ImagesNode {
  kind: "images";
  tracks: Tracks;
  images: ImageNode[];
}

export interface DocumentNode {
  kind: "document";
  src: string;
  title?: string;
  mode: "link" | "embed";
}

export interface ColumnsNode {
  kind: "columns";
  /** Grid tracks; cells beyond the first row wrap into the next one (spec 9.1). */
  tracks: Tracks;
  /** `divider: true` — a meaningful vertical rule between the tracks. */
  divider: boolean;
  cells: BioNode[][];
}

/** Bordered notice / callout (spec 11). */
export interface FrameNode {
  kind: "frame";
  tone: FrameTone;
  title?: string;
  children: BioNode[];
}

/** Closing author/place/credit block (spec 12). */
export interface SignatureNode {
  kind: "signature";
  children: BioNode[];
}

/** A named place in the article that a link can jump to (spec 19). */
export interface AnchorNode {
  kind: "anchor";
  /** Canonical name (see anchors.ts); the renderer turns it into an element id. */
  name: string;
}

export interface UnknownNode {
  kind: "unknown";
  name: string;
  children: BioNode[];
}

export type BioNode =
  | MarkdownNode
  | LeadNode
  | AlignNode
  | ImageNode
  | ImagesNode
  | DocumentNode
  | ColumnsNode
  | NavNode
  | FrameNode
  | SignatureNode
  | AnchorNode
  | UnknownNode;

export interface BioDoc {
  /** The document's top-level `# ` title line(s), removed from the body.
   *  At most two: the spec asks for exactly one (§2), but a migrated document
   *  often splits a name over two lines, and the codex reads the second as the
   *  subtitle line rather than as a heading in the prose. */
  titles: string[];
  nodes: BioNode[];
  warnings: string[];
}

/** One fence line: `::: name` opens (group 1 set), a bare `:::` closes. */
const FENCE = /^:::[ \t]*([A-Za-z][\w-]*)?[ \t]*$/;
const PROP_LINE = /^([A-Za-z][\w-]*):[ \t]*(.*)$/;

/**
 * The one-line spelling of an anchor — `:: anchor{#name}` (spec 19). A marker
 * has no body, so it needs no closing fence, and the legacy `::` form is
 * accepted beside `:::` because migrated documents are written that way.
 */
const ANCHOR_LINE = /^:{2,3}[ \t]*anchor[ \t]*\{([^}]*)\}[ \t]*$/i;

/**
 * The one-line anchor as an ordinary block segment, or null for any other line.
 * Desugaring it into a property line is what keeps the directive table the only
 * description of the grammar — `anchor` needs no branch of its own anywhere.
 */
function anchorSegment(line: string): RawBlock | null {
  const marker = ANCHOR_LINE.exec(line);
  return marker ? { name: "anchor", lines: [`id: ${marker[1].trim()}`] } : null;
}

type Warn = string[];

interface RawBlock {
  name: string;
  lines: string[];
}

type Segment = { md: string[] } | RawBlock;

const NO_PROPS: readonly string[] = [];

/** Split lines into markdown runs and (possibly nested) fenced blocks. */
function segment(lines: string[], warn: Warn): Segment[] {
  const out: Segment[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.some(hasText)) out.push({ md: run });
    run = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const marker = anchorSegment(lines[i]);
    if (marker) {
      flush();
      out.push(marker);
      continue;
    }
    const name = FENCE.exec(lines[i])?.[1];
    if (!name) {
      run.push(lines[i]);
      continue;
    }
    flush();
    const inner: string[] = [];
    let depth = 1;
    while (++i < lines.length) {
      const fence = FENCE.exec(lines[i]);
      if (fence) {
        if (fence[1]) depth++;
        else if (--depth === 0) break;
      }
      inner.push(lines[i]);
    }
    if (depth > 0) warn.push(`Unclosed ::: ${name} block — content kept to end of file.`);
    out.push({ name: name.toLowerCase(), lines: inner });
  }
  flush();
  return out;
}

function hasText(line: string): boolean {
  return /\S/.test(line);
}

/* ------------------------------------------------------------------ *
 * Property values
 * ------------------------------------------------------------------ */

/** Allowlisted property value; undefined when absent or unrecognised. */
function enumProp<T extends string>(raw: string | undefined, allowed: readonly T[]): T | undefined {
  const value = raw?.trim().toLowerCase();
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

/** Same, for a property with a documented default and no diagnostic. */
function oneOf<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return enumProp(raw, allowed) ?? fallback;
}

/** Same, but an unrecognised token warns and falls back (spec 6.5, 11, 13).
 *  The fallback's own type flows through, so a defaulted token is never
 *  `undefined` and needs no cast at the call site. */
function token<T extends string, F extends T | undefined>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: F,
  warn: Warn,
  label: string,
): T | F {
  const value = enumProp(raw, allowed);
  if (raw?.trim() && !value) warn.push(`Unknown ${label} "${raw.trim()}" — using the default.`);
  return value ?? fallback;
}

const POSITIONS: readonly ImagePosition[] = ["left", "right", "center", "full"];
const SIZES: readonly ImageSize[] = ["small", "medium", "large", "full"];
const ALIGNMENTS: readonly ContentAlignment[] = ["left", "center", "right"];
const FRAMES: readonly ImageFrame[] = ["curl", "none", "mat", "black", "white", "red", "gold"];
const TONES: readonly FrameTone[] = ["gold", "black", "red", "white"];

/** `columns: 2|3|4` — the explicit track count of a grid (spec 7, 9.1). */
function tracks(raw: string | undefined, warn: Warn, block: string): Tracks | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const count = Number(value);
  if (count === 2 || count === 3 || count === 4) return count;
  warn.push(`::: ${block} has an invalid columns value "${value}" — using the default.`);
  return undefined;
}

/** A `true`/`false` flag; anything else warns and reads as false (spec 9). */
function flag(raw: string | undefined, warn: Warn, label: string): boolean {
  const value = token(raw, ["true", "false"] as const, "false", warn, label);
  return value === "true";
}

/**
 * Block properties bypass react-markdown's URL handling, so a click target is
 * validated here: relative paths, fragments, http(s) and mailto only.
 */
function parseLink(raw: string | undefined, warn: Warn): string | undefined {
  const link = raw?.trim();
  if (!link) return undefined;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(link);
  if (!scheme || /^(?:https?|mailto)$/i.test(scheme[1])) return link;
  warn.push(`Unsafe link target — ignored: "${link}"`);
  return undefined;
}

/* ------------------------------------------------------------------ *
 * The directive table
 * ------------------------------------------------------------------ */

interface BlockCtx {
  name: string;
  props: Record<string, string>;
  /** Body lines with the property header removed. */
  body: string[];
  warn: Warn;
}

interface BlockSpec {
  /** Documented property names (spec 4.1); anything else warns. */
  props?: readonly string[];
  /** Properties only, no body — every line is read as a property. */
  leaf?: true;
  /** Direct child kinds this container refuses (spec 4.1 nesting). */
  rejects?: readonly BioNode["kind"][];
  /** Build the node(s); null drops a block that has nothing left to render. */
  build(ctx: BlockCtx): BioNode | BioNode[] | null;
}

const BLOCKS = new Map<string, BlockSpec>(
  Object.entries<BlockSpec>({
    lead: {
      build: (c) => ({ kind: "lead", children: children(c) }),
    },

    align: {
      props: ["position"],
      rejects: ["columns", "nav"],
      build: (c) => {
        const position = token(c.props.position, ALIGNMENTS, undefined, c.warn, "position") ?? null;
        if (!position && !c.props.position) {
          c.warn.push("::: align without required position — rendered at default alignment.");
        }
        return { kind: "align", position, children: children(c) };
      },
    },

    image: {
      leaf: true,
      props: ["src", "position", "size", "alt", "caption", "link", "frame"],
      build: ({ props, warn }) => {
        if (!props.src) {
          warn.push("::: image without required src — skipped.");
          return null;
        }
        return {
          kind: "image",
          src: props.src,
          // Silent defaults: a child of ::: images legitimately omits both.
          position: oneOf(props.position, POSITIONS, "center"),
          size: oneOf(props.size, SIZES, "medium"),
          caption: props.caption || undefined,
          alt: props.alt || undefined,
          link: parseLink(props.link, warn),
          frame: token(props.frame, FRAMES, undefined, warn, "frame"),
        };
      },
    },

    images: {
      props: ["columns", "frame"],
      build: (c) => {
        const images: ImageNode[] = [];
        const strays: BioNode[] = [];
        // A group is a grid, so an anchor between two pictures cannot stand as a
        // node of its own — it would claim a whole cell. It names the picture it
        // introduces instead (spec 19); one with no picture left stays a stray.
        let marker: AnchorNode | undefined;
        for (const node of children(c)) {
          if (node.kind === "anchor") {
            if (marker) strays.push(marker);
            marker = node;
          } else if (node.kind === "image") {
            images.push(marker ? { ...node, anchor: marker.name } : node);
            marker = undefined;
          } else {
            strays.push(node);
          }
        }
        if (marker) strays.push(marker);
        if (strays.length) {
          c.warn.push("::: images accepts only ::: image children — other content follows the group.");
        }
        if (!images.length) {
          c.warn.push("::: images without any ::: image child — group skipped.");
          return strays.length ? strays : null;
        }
        const frame = token(c.props.frame, FRAMES, undefined, c.warn, "frame");
        const group: ImagesNode = {
          kind: "images",
          tracks: tracks(c.props.columns, c.warn, "images") ?? (clamp(images.length, 2, 4) as Tracks),
          // A group frame is the default for children that don't set their own.
          images: frame ? images.map((img) => (img.frame ? img : { ...img, frame })) : images,
        };
        return strays.length ? [group, ...strays] : group;
      },
    },

    document: {
      leaf: true,
      props: ["src", "title", "mode"],
      build: ({ props, warn }) => {
        if (!props.src) {
          warn.push("::: document without required src — skipped.");
          return null;
        }
        return {
          kind: "document",
          src: props.src,
          title: props.title || undefined,
          mode: oneOf(props.mode, ["link", "embed"] as const, "link"),
        };
      },
    },

    columns: {
      props: ["columns", "divider"],
      build: (c) => {
        const cells: BioNode[][] = [];
        // An anchor directly inside the grid would claim a whole track, so it
        // opens the next cell rather than becoming one (spec 19).
        let markers: BioNode[] = [];
        const openCell = (nodes: BioNode[]) => {
          cells.push(markers.length ? [...markers, ...nodes] : nodes);
          markers = [];
        };
        for (const seg of segment(c.body, c.warn)) {
          if ("md" in seg) {
            // Stray markdown directly inside ::: columns → its own cell.
            const nodes = parseNodes(seg.md, c.warn);
            if (!nodes.length) continue;
            c.warn.push("Content directly inside ::: columns — wrapped as one column.");
            openCell(nodes);
          } else if (seg.name === "column") {
            openCell(childrenOf("column", seg.lines, c.warn));
          } else if (seg.name === "anchor") {
            markers.push(...nodesOf(buildBlock(seg, c.warn)));
          } else {
            // Any other block: keep the block itself, not its raw property lines.
            c.warn.push(`::: ${seg.name} directly inside ::: columns — wrapped as one column.`);
            const cell = nodesOf(buildBlock(seg, c.warn));
            if (cell.length) openCell(cell);
          }
        }
        if (!cells.length) {
          c.warn.push("::: columns without any ::: column child — skipped.");
          return markers.length ? markers : null;
        }
        const explicit = tracks(c.props.columns, c.warn, "columns");
        if (!explicit && cells.length > 3) {
          c.warn.push("More than three columns without `columns:` — the grid wraps at three.");
        }
        const grid: ColumnsNode = {
          kind: "columns",
          tracks: explicit ?? (clamp(cells.length, 1, 3) as Tracks),
          divider: flag(c.props.divider, c.warn, "divider"),
          cells,
        };
        // A marker with no cell left to open keeps its place after the grid.
        return markers.length ? [grid, ...markers] : grid;
      },
    },

    column: {
      rejects: ["columns"],
      // A column outside ::: columns — tolerate, render as plain content.
      build: (c) => ({ kind: "unknown", name: "column", children: children(c) }),
    },

    nav: {
      props: ["title", "active"],
      build: (c) => {
        // A nav keeps its body as raw Markdown, so it is the one container that
        // never re-segments: lift any marker out by hand, or it would print as
        // text in the bar. It then marks the bar's own place (spec 19).
        const markers: BioNode[] = [];
        const body = c.body.filter((line) => {
          const marker = anchorSegment(line);
          if (!marker) return true;
          markers.push(...nodesOf(buildBlock(marker, c.warn)));
          return false;
        });
        repairHardBreaks(body, c.warn);
        const markdown = body.join("\n").trim();
        if (!markdown) {
          c.warn.push("::: nav without a link list — skipped.");
          return markers.length ? markers : null;
        }
        const bar: NavNode = {
          kind: "nav",
          title: c.props.title || undefined,
          active: c.props.active || undefined,
          markdown,
        };
        return markers.length ? [...markers, bar] : bar;
      },
    },

    frame: {
      props: ["frame", "title"],
      rejects: ["frame", "nav"],
      build: (c) => ({
        kind: "frame",
        tone: token(c.props.frame, TONES, "gold", c.warn, "frame"),
        title: c.props.title || undefined,
        children: children(c),
      }),
    },

    signature: {
      build: (c) => ({ kind: "signature", children: children(c) }),
    },

    anchor: {
      leaf: true,
      props: ["id"],
      build: ({ props, warn }) => {
        const name = anchorName(props.id ?? "");
        if (!name) {
          warn.push("::: anchor without a name — skipped.");
          return null;
        }
        return { kind: "anchor", name };
      },
    },
  }),
);

/** Unregistered directive: keep the body, drop the layout (spec 4, 17). */
const UNKNOWN_BLOCK: BlockSpec = {
  build: (c) => ({ kind: "unknown", name: c.name, children: children(c) }),
};

/* ------------------------------------------------------------------ *
 * Driver
 * ------------------------------------------------------------------ */

/**
 * Split the leading `key: value` header (spec 4) from the body. Only *declared*
 * keys count as properties, so a typo or a prose line that merely looks like a
 * property warns and stays in the body instead of being silently swallowed.
 */
function splitProps(lines: string[], declared: readonly string[], name: string, warn: Warn) {
  const props: Record<string, string> = {};
  let i = 0;
  let seen = false;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      if (seen) break; // a blank line closes the header
      continue; // blank lines before it are insignificant
    }
    const prop = PROP_LINE.exec(line);
    if (!prop) break;
    const key = prop[1].toLowerCase();
    if (!declared.includes(key)) {
      warn.push(`Unknown property "${key}" in ::: ${name} — kept as text.`);
      break;
    }
    props[key] = prop[2].trim();
    seen = true;
    i++;
  }
  return { props, body: lines.slice(i) };
}

/** A leaf directive is nothing but properties; anything else warns (spec 4.1). */
function leafProps(lines: string[], declared: readonly string[], name: string, warn: Warn) {
  const props: Record<string, string> = {};
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    const prop = PROP_LINE.exec(text);
    if (!prop) {
      warn.push(`Ignored non-property line in ::: ${name}: "${text}"`);
      continue;
    }
    const key = prop[1].toLowerCase();
    if (declared.includes(key)) props[key] = prop[2].trim();
    else warn.push(`Unknown property "${key}" in ::: ${name} — ignored.`);
  }
  return { props, body: [] as string[] };
}

/** Children of a container, with the parent's nesting rules applied. */
function childrenOf(name: string, body: string[], warn: Warn): BioNode[] {
  const nodes = parseNodes(body, warn);
  const rejects = BLOCKS.get(name)?.rejects;
  if (!rejects) return nodes;
  return nodes.flatMap((node) => {
    if (!rejects.includes(node.kind)) return [node];
    warn.push(`::: ${node.kind} is not allowed inside ::: ${name} — kept without that layout.`);
    return readableContent(node);
  });
}

function children(c: BlockCtx): BioNode[] {
  return childrenOf(c.name, c.body, c.warn);
}

/** What survives when a block sits where it may not: its content, unwrapped. */
function readableContent(node: BioNode): BioNode[] {
  switch (node.kind) {
    case "lead":
    case "align":
    case "frame":
    case "signature":
    case "unknown":
      return node.children;
    case "columns":
      return node.cells.flat();
    case "images":
      return node.images;
    case "nav":
      return [{ kind: "markdown", text: node.markdown }];
    default:
      return [node];
  }
}

function buildBlock(block: RawBlock, warn: Warn): BioNode | BioNode[] | null {
  const spec = BLOCKS.get(block.name);
  if (!spec) warn.push(`Unknown block ::: ${block.name} — rendering its inner content.`);
  const active = spec ?? UNKNOWN_BLOCK;
  const declared = active.props ?? NO_PROPS;
  const { props, body } = active.leaf
    ? leafProps(block.lines, declared, block.name, warn)
    : splitProps(block.lines, declared, block.name, warn);
  return active.build({ name: block.name, props, body, warn });
}

/** A builder's result as a node list — it may return one node, several, or none. */
function nodesOf(built: BioNode | BioNode[] | null): BioNode[] {
  return built ? (Array.isArray(built) ? built : [built]) : [];
}

/* ------------------------------------------------------------------ *
 * Hard-break diagnostics (spec 3.1)
 *
 * The scanners below read past the end of the string deliberately: charCodeAt
 * returns NaN there and NaN fails every comparison, so no length guard is
 * needed and no substring or match array is ever allocated.
 * ------------------------------------------------------------------ */

const SPACE = 32;
const TAB = 9;
const BACKSLASH = 92;
const BACKTICK = 96;
const TILDE = 126;

/** A construct that begins a new block, so it cannot continue a paragraph. */
const BLOCK_START =
  /^[ \t]{0,3}(?:[-*+][ \t]|\d{1,9}[.)][ \t]|#{1,6}[ \t]|>|:::|```|~~~|(?:[-*_][ \t]*){3,}$)/;

/** Index of the first character after at most three spaces of indentation. */
function indentEnd(line: string): number {
  let i = 0;
  while (i < 3) {
    const code = line.charCodeAt(i);
    if (code !== SPACE && code !== TAB) break;
    i++;
  }
  return i;
}

/**
 * Length of a code fence's `marker` run — three or more markers after at most
 * three spaces of indent, else 0. A *closing* fence carries no info string, so
 * ` ```js ` cannot close what ` ``` ` opened and a `~~~` block is not closed by
 * backticks; a naive toggle gets both wrong and silences the rest of the file.
 */
function fenceRun(line: string, marker: number, closing: boolean): number {
  const start = indentEnd(line);
  if (line.charCodeAt(start) !== marker) return 0;
  let end = start + 1;
  while (line.charCodeAt(end) === marker) end++;
  if (end - start < 3) return 0;
  if (closing) {
    for (let i = end; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code !== SPACE && code !== TAB) return 0;
    }
  }
  return end - start;
}

/** How many backslashes end the line; an even run is one escaped literal `\`. */
function trailingBackslashes(line: string): number {
  let i = line.length - 1;
  while (line.charCodeAt(i) === BACKSLASH) i--;
  return line.length - 1 - i;
}

/** A CommonMark blank line holds spaces and tabs only — an NBSP is content. */
function isBlank(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i);
    if (code !== SPACE && code !== TAB) return false;
  }
  return true;
}

/**
 * A trailing `\` is a Markdown hard break — but only *inside* a block. At the end
 * of a paragraph, heading or list item it has nothing to join, and CommonMark
 * renders it as a visible backslash, which is never what an author meant.
 *
 * Such a break carries no content, so it is dropped rather than displayed
 * (spec 3.1, and the same cleanup licence as 1/5 and 16.3) — and warned about, so
 * the source still gets cleaned up. An author who wants a literal trailing
 * backslash escapes it (`\\`), which is an even run and left alone.
 *
 * Rewrites `lines` in place: they belong to the segment being parsed and are
 * joined into one Markdown island straight afterwards.
 *
 * One pass, allocation-free apart from a repair: a line costs one charCodeAt for
 * the fence probe and one for the break probe, and the regex runs only for a line
 * that ends in `\`.
 */
function repairHardBreaks(lines: string[], warn: Warn): void {
  let marker = 0; // the fence we are inside; 0 = prose
  let fence = 0; // length of the run that opened it
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (marker) {
      if (fenceRun(line, marker, true) >= fence) marker = 0;
      continue; // inside a code block a backslash is data
    }
    // Only a ` or ~ — after at most three spaces — can open a fence.
    let head = line.charCodeAt(0);
    if (head === SPACE || head === TAB) head = line.charCodeAt(indentEnd(line));
    if (head === BACKTICK || head === TILDE) {
      const run = fenceRun(line, head, false);
      if (run) {
        marker = head;
        fence = run;
        continue;
      }
    }
    if (line.charCodeAt(line.length - 1) !== BACKSLASH) continue; // the common case
    if ((trailingBackslashes(line) & 1) === 0) continue;
    const next = lines[i + 1];
    if (next !== undefined && !isBlank(next) && !BLOCK_START.test(next)) continue;
    lines[i] = line.slice(0, -1).trimEnd();
    warn.push(`Trailing "\\" ends a block and cannot join anything — dropped: "${line.trim()}"`);
  }
}

function parseNodes(lines: string[], warn: Warn): BioNode[] {
  const nodes: BioNode[] = [];
  for (const seg of segment(lines, warn)) {
    if ("md" in seg) {
      repairHardBreaks(seg.md, warn);
      const text = seg.md.join("\n").trim();
      if (text) nodes.push({ kind: "markdown", text });
    } else {
      nodes.push(...nodesOf(buildBlock(seg, warn)));
    }
  }
  return nodes;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/* ------------------------------------------------------------------ *
 * Title lines
 * ------------------------------------------------------------------ */

/** How many `# ` lines are read as the document's title. Spec §2 asks for one;
 *  the second is tolerated as its subtitle line. A third stays body text — at
 *  that point the `#`s are section headings, not a name. */
const TITLE_LIMIT = 2;

/** A level-one ATX heading, with CommonMark's optional closing run of `#`. */
const H1 = /^ {0,3}#(?!#)[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

/**
 * Take the title line(s) out of one Markdown island.
 *
 * Fenced content is skipped: inside a code fence — or a verse fence (§3.9) — a
 * leading `#` is the text itself, not a heading. The fence bookkeeping is the
 * same as `repairHardBreaks`', for the same reason.
 */
function takeHeadings(text: string, titles: string[]): string {
  if (!text.includes("#")) return text;
  const kept: string[] = [];
  let marker = 0; // the fence we are inside; 0 = prose
  let fence = 0; // length of the run that opened it

  for (const line of text.split("\n")) {
    if (marker) {
      if (fenceRun(line, marker, true) >= fence) marker = 0;
    } else {
      let head = line.charCodeAt(0);
      if (head === SPACE || head === TAB) head = line.charCodeAt(indentEnd(line));
      const run = head === BACKTICK || head === TILDE ? fenceRun(line, head, false) : 0;
      if (run) {
        marker = head;
        fence = run;
      } else if (titles.length < TITLE_LIMIT) {
        const name = H1.exec(line)?.[1].trim();
        if (name) {
          titles.push(name);
          continue;
        }
      }
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/**
 * Lift the document's title line(s) out of the body, wherever they sit.
 *
 * Not necessarily at the top: a migrated document commonly centres its name
 * inside an `::: align`, and a name split over two `# ` lines is exactly what
 * the codex plate wants as title and subtitle. Whatever is left empty behind
 * them is pruned, so a wrapper that held nothing else does not render as a
 * blank box. `::: nav` is skipped — a `#` in a link bar is not a title.
 */
function extractTitles(nodes: BioNode[], titles: string[] = []): string[] {
  for (let i = 0; i < nodes.length && titles.length < TITLE_LIMIT; i++) {
    const node = nodes[i];
    switch (node.kind) {
      case "markdown":
        node.text = takeHeadings(node.text, titles);
        break;
      case "lead":
      case "align":
      case "frame":
      case "signature":
      case "unknown":
        extractTitles(node.children, titles);
        break;
      case "columns":
        for (const cell of node.cells) extractTitles(cell, titles);
        break;
      default:
        continue; // no prose of its own: image, images, document, nav, anchor
    }
    if (isEmpty(node)) nodes.splice(i--, 1);
  }
  return titles;
}

/** Has this node been left with nothing to render? */
function isEmpty(node: BioNode): boolean {
  switch (node.kind) {
    case "markdown":
      return !node.text;
    case "lead":
    case "align":
    case "frame":
    case "signature":
    case "unknown":
      return !node.children.length;
    case "columns":
      return node.cells.every((cell) => !cell.length);
    default:
      return false;
  }
}

export function parseBioMd(source: string): BioDoc {
  const warnings: Warn = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const nodes = parseNodes(lines, warnings);
  return { titles: extractTitles(nodes), nodes, warnings };
}
