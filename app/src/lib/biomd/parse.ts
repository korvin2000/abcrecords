/**
 * BioMD Lite parser (docs/Biography-Markup.md).
 *
 * BioMD = plain Markdown + `::: name … :::` layout/media blocks:
 *   lead · image · images · document · columns · column
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

export interface ImageNode {
  kind: "image";
  src: string;
  position: ImagePosition;
  size: ImageSize;
  caption?: string;
}

export interface MarkdownNode {
  kind: "markdown";
  text: string;
}

export interface LeadNode {
  kind: "lead";
  children: BioNode[];
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
  | ImageNode
  | ImagesNode
  | DocumentNode
  | ColumnsNode
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

const POSITIONS: ImagePosition[] = ["left", "right", "center", "full"];
const SIZES: ImageSize[] = ["small", "medium", "large", "full"];

function oneOf<T extends string>(v: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes((v ?? "") as T) ? (v as T) : fallback;
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
  };
}

function parseBlock(block: RawBlock, warnings: string[]): BioNode | null {
  switch (block.name) {
    case "lead":
      return { kind: "lead", children: parseNodes(block.lines, warnings) };

    case "image":
      return parseImage(block, warnings);

    case "images": {
      const inner = segment(block.lines, warnings);
      const images: ImageNode[] = [];
      let columns = 0;
      for (const seg of inner) {
        if ("md" in seg) {
          const props = parseProps(seg.md, warnings, "images");
          if (props.columns) columns = Number(props.columns);
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
      return { kind: "images", columns: cols, images };
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
