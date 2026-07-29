/**
 * BioMD Lite parser (docs/Biography-Markup.md, v1.3).
 *
 * BioMD = plain Markdown + `::: name … :::` layout/media blocks:
 *   lead · align · image · images · document · columns · column · nav
 *
 * Engine rules honoured here:
 *  - source order is logical reading order — the tree preserves it;
 *  - unknown blocks keep their inner content (rendered, warned) — content
 *    is never deleted;
 *  - a missing closing fence is tolerated (block runs to EOF, warned);
 *  - metadata never comes from the article — this parses layout/text only.
 */

export type ImagePosition = "left" | "right" | "center" | "full";
export type ImageSize = "small" | "medium" | "large" | "full";
/** `::: align` — how a bounded group of content is aligned (spec 13). */
export type ContentAlignment = "left" | "center" | "right";
/** `frame:` — theme-named picture frame around an image (spec 6.5). */
export type ImageFrame = "curl" | "none" | "mat" | "black" | "white" | "red" | "gold";

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
  columns: 2 | 3 | 4;
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
  columns: BioNode[][];
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
  | UnknownNode;

export interface BioDoc {
  /** Text of the first top-level `# ` heading, if any (removed from body). */
  title: string | null;
  nodes: BioNode[];
  warnings: string[];
}

const FENCE_OPEN = /^:::\s*([A-Za-z][\w-]*)\s*$/;
const FENCE_CLOSE = /^:::\s*$/;
const PROP_LINE = /^([A-Za-z][\w-]*):\s*(.*)$/;

interface RawBlock {
  name: string;
  lines: string[];
}

type Segment = { md: string[] } | RawBlock;

/** Split lines into markdown runs and (possibly nested) fenced blocks. */
function segment(lines: string[], warnings: string[]): Segment[] {
  const out: Segment[] = [];
  let mdRun: string[] = [];
  let i = 0;

  const flushMd = () => {
    if (mdRun.some((l) => l.trim() !== "")) out.push({ md: mdRun });
    mdRun = [];
  };

  while (i < lines.length) {
    const open = FENCE_OPEN.exec(lines[i]);
    if (!open) {
      mdRun.push(lines[i]);
      i++;
      continue;
    }
    flushMd();
    const name = open[1].toLowerCase();
    const inner: string[] = [];
    let depth = 1;
    i++;
    while (i < lines.length && depth > 0) {
      if (FENCE_OPEN.test(lines[i])) depth++;
      else if (FENCE_CLOSE.test(lines[i])) {
        depth--;
        if (depth === 0) break;
      }
      inner.push(lines[i]);
      i++;
    }
    if (depth > 0) warnings.push(`Unclosed ::: ${name} block — content kept to end of file.`);
    else i++; // skip the closing :::
    out.push({ name, lines: inner });
  }
  flushMd();
  return out;
}

/** Parse `key: value` property lines from a leaf block. */
function parseProps(lines: string[], warnings: string[], blockName: string) {
  const props: Record<string, string> = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = PROP_LINE.exec(line.trim());
    if (m) props[m[1].toLowerCase()] = m[2].trim();
    else warnings.push(`Ignored non-property line in ::: ${blockName}: "${line.trim()}"`);
  }
  return props;
}

/**
 * Split a block that owns BOTH properties and content (`align`, `nav`) into its
 * leading `key: value` header and the remaining body lines — spec 4: "a blank
 * line separates properties from body content". Tolerant: the header also ends
 * at the first line that is not a property, so a body may follow immediately.
 */
function splitPropsAndBody(lines: string[]): { props: Record<string, string>; body: string[] } {
  const props: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      if (Object.keys(props).length) break; // blank line closes the header
      continue; // blank lines before the header are insignificant
    }
    const m = PROP_LINE.exec(lines[i].trim());
    if (!m) break;
    props[m[1].toLowerCase()] = m[2].trim();
    i++;
  }
  return { props, body: lines.slice(i) };
}

const POSITIONS: ImagePosition[] = ["left", "right", "center", "full"];
const SIZES: ImageSize[] = ["small", "medium", "large", "full"];
const ALIGNMENTS: ContentAlignment[] = ["left", "center", "right"];
const FRAMES: ImageFrame[] = ["curl", "none", "mat", "black", "white", "red", "gold"];

/** Allowlisted property value; undefined when absent or unrecognised. */
function enumProp<T extends string>(v: string | undefined, allowed: T[]): T | undefined {
  const value = v?.trim().toLowerCase();
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

/** Same, for a required property that has a documented default. */
function oneOf<T extends string>(v: string | undefined, allowed: T[], fallback: T): T {
  return enumProp(v, allowed) ?? fallback;
}

/** `frame:` — an unknown token keeps the default frame instead of dropping it. */
function parseFrame(raw: string | undefined, warnings: string[]): ImageFrame | undefined {
  const frame = enumProp(raw, FRAMES);
  if (raw && !frame) warnings.push(`Unknown frame "${raw.trim()}" — using the default frame.`);
  return frame;
}

/**
 * Block properties bypass react-markdown's URL handling, so a click target is
 * validated here: relative paths, fragments, http(s) and mailto only.
 */
function parseLink(raw: string | undefined, warnings: string[]): string | undefined {
  const link = raw?.trim();
  if (!link) return undefined;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(link);
  if (!scheme || /^(?:https?|mailto)$/i.test(scheme[1])) return link;
  warnings.push(`Unsafe link target — ignored: "${link}"`);
  return undefined;
}

function parseImage(block: RawBlock, warnings: string[]): ImageNode | null {
  const props = parseProps(block.lines, warnings, "image");
  if (!props.src) {
    warnings.push("::: image without required src — skipped.");
    return null;
  }
  return {
    kind: "image",
    src: props.src,
    position: oneOf(props.position, POSITIONS, "center"),
    size: oneOf(props.size, SIZES, "medium"),
    caption: props.caption || undefined,
    alt: props.alt || undefined,
    link: parseLink(props.link, warnings),
    frame: parseFrame(props.frame, warnings),
  };
}

function parseBlock(block: RawBlock, warnings: string[]): BioNode | null {
  switch (block.name) {
    case "lead":
      return { kind: "lead", children: parseNodes(block.lines, warnings) };

    case "align": {
      const { props, body } = splitPropsAndBody(block.lines);
      const position = enumProp(props.position, ALIGNMENTS) ?? null;
      if (!position) {
        warnings.push(
          props.position
            ? `::: align has unknown position "${props.position}" — rendered at default alignment.`
            : "::: align without required position — rendered at default alignment.",
        );
      }
      return { kind: "align", position, children: parseNodes(body, warnings) };
    }

    case "image":
      return parseImage(block, warnings);

    case "images": {
      const inner = segment(block.lines, warnings);
      const images: ImageNode[] = [];
      let columns = 0;
      let groupFrame: ImageFrame | undefined;
      for (const seg of inner) {
        if ("md" in seg) {
          const props = parseProps(seg.md, warnings, "images");
          if (props.columns) columns = Number(props.columns);
          if (props.frame) groupFrame = parseFrame(props.frame, warnings);
        } else if (seg.name === "image") {
          const img = parseImage(seg, warnings);
          if (img) images.push(img);
        } else {
          warnings.push(`Unexpected ::: ${seg.name} inside ::: images — ignored.`);
        }
      }
      const cols = ([2, 3, 4] as const).includes(columns as 2 | 3 | 4)
        ? (columns as 2 | 3 | 4)
        : (Math.min(Math.max(images.length, 2), 4) as 2 | 3 | 4);
      // A group frame is the default for children that don't set their own.
      return {
        kind: "images",
        columns: cols,
        images: groupFrame ? images.map((img) => (img.frame ? img : { ...img, frame: groupFrame })) : images,
      };
    }

    case "document": {
      const props = parseProps(block.lines, warnings, "document");
      if (!props.src) {
        warnings.push("::: document without required src — skipped.");
        return null;
      }
      return {
        kind: "document",
        src: props.src,
        title: props.title || undefined,
        mode: props.mode === "embed" ? "embed" : "link",
      };
    }

    case "columns": {
      const inner = segment(block.lines, warnings);
      const columns: BioNode[][] = [];
      for (const seg of inner) {
        if ("md" in seg) {
          // Stray markdown directly inside ::: columns → its own column.
          const nodes = parseNodes(seg.md, warnings);
          if (nodes.length) columns.push(nodes);
        } else if (seg.name === "column") {
          columns.push(parseNodes(seg.lines, warnings));
        } else {
          // A non-column block directly inside columns → wrap as a column.
          const node = parseBlock(seg, warnings);
          if (node) columns.push([node]);
        }
      }
      return { kind: "columns", columns: columns.slice(0, 3) };
    }

    case "column":
      // A column outside ::: columns — tolerate, render as plain content.
      return { kind: "unknown", name: "column", children: parseNodes(block.lines, warnings) };

    case "nav": {
      const { props, body } = splitPropsAndBody(block.lines);
      const markdown = body.join("\n").trim();
      if (!markdown) {
        warnings.push("::: nav without a link list — skipped.");
        return null;
      }
      return {
        kind: "nav",
        title: props.title || undefined,
        active: props.active || undefined,
        markdown,
      };
    }

    default:
      warnings.push(`Unknown block ::: ${block.name} — rendering its inner content.`);
      return { kind: "unknown", name: block.name, children: parseNodes(block.lines, warnings) };
  }
}

function parseNodes(lines: string[], warnings: string[]): BioNode[] {
  const nodes: BioNode[] = [];
  for (const seg of segment(lines, warnings)) {
    if ("md" in seg) {
      const text = seg.md.join("\n").trim();
      if (text) nodes.push({ kind: "markdown", text });
    } else {
      const node = parseBlock(seg, warnings);
      if (node) nodes.push(node);
    }
  }
  return nodes;
}

/** Extract the article title (`# …`) from the first markdown node. */
function extractTitle(nodes: BioNode[]): string | null {
  const first = nodes[0];
  if (!first || first.kind !== "markdown") return null;
  const m = /^#\s+(.+?)\s*$/m.exec(first.text);
  if (!m || first.text.indexOf(m[0]) !== 0) return null;
  const rest = first.text.slice(m[0].length).trim();
  if (rest) first.text = rest;
  else nodes.shift();
  return m[1];
}

export function parseBioMd(source: string): BioDoc {
  const warnings: string[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const nodes = parseNodes(lines, warnings);
  const title = extractTitle(nodes);
  return { title, nodes, warnings };
}
