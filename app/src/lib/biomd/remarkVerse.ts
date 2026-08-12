import { visit } from "unist-util-visit";
import type { Node, Parent } from "unist";

interface CodeNode extends Node {
  type: "code";
  lang?: string | null;
  value: string;
}

/**
 * remark plugin for BioMD's verse blocks (spec 3.9): a fence with no info
 * string (` ``` … ``` `) in an article holds a poem, a song text or programme
 * lines, never source code. The fence is there for one reason — Markdown would
 * otherwise fold the lines of a stanza into a single paragraph — and a code
 * block is the wrong rendering for it: monospaced, unwrapped, and sideways.
 *
 * Each blank-line-separated stanza becomes a paragraph and each source line a
 * hard break, so the verse keeps its lineation, wraps like prose on a narrow
 * screen, and survives a copy with its line structure intact. `.bio-verse`
 * carries the typography.
 *
 * A fence that names a language (` ```json `) is left alone: that one really is
 * code. An empty fence carries nothing and is dropped (spec 16.3).
 *
 * Runs last, after remarkHighlight, so a fenced text stays literal exactly as
 * it was fenced — no `==highlight==` or other inline syntax is read inside it.
 */
export function remarkVerse() {
  return (tree: Node) => {
    visit(tree, "code", (node: CodeNode, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined || node.lang) return;
      const stanzas = stanzasOf(node.value);
      if (!stanzas.length) {
        parent.children.splice(index, 1);
        return index; // the next sibling has taken this index
      }
      parent.children.splice(index, 1, verse(stanzas));
      return index + 1;
    });
  };
}

/**
 * Lines grouped into stanzas. Blank runs are the group separator (and are not
 * content, so leading, trailing and repeated ones collapse); each line is
 * trimmed, because a fence's indentation is a source artefact, not layout.
 */
function stanzasOf(value: string): string[][] {
  const stanzas: string[][] = [];
  let lines: string[] = [];
  for (const raw of value.split("\n")) {
    const line = raw.trim();
    if (line) lines.push(line);
    else if (lines.length) {
      stanzas.push(lines);
      lines = [];
    }
  }
  if (lines.length) stanzas.push(lines);
  return stanzas;
}

/** `<div class="bio-verse">` of `<p>` stanzas whose lines are `<br>`-joined. */
function verse(stanzas: string[][]): Node {
  return {
    type: "biomdVerse",
    data: { hName: "div", hProperties: { className: "bio-verse" } },
    children: stanzas.map((lines) => ({
      type: "paragraph",
      children: lines.flatMap((line, i) =>
        i === 0 ? [text(line)] : [{ type: "break" } as Node, text(line)],
      ),
    })),
  } as Node;
}

function text(value: string): Node {
  return { type: "text", value } as Node;
}
