import { visit } from "unist-util-visit";
import type { Node, Parent } from "unist";

interface TextNode extends Node {
  type: "text";
  value: string;
}

/**
 * remark plugin for BioMD's `==semantic highlight==` syntax.
 * Splits text nodes and emits `<mark>` elements via data.hName —
 * the theme decides the highlight colour (see .bio-article mark).
 */
export function remarkHighlight() {
  return (tree: Node) => {
    visit(tree, "text", (node: TextNode, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const parts = node.value.split(/==([^=\n]+)==/g);
      if (parts.length < 3) return;
      const replacement: Node[] = [];
      parts.forEach((part, i) => {
        if (i % 2 === 1) {
          replacement.push({
            type: "biomdHighlight",
            data: { hName: "mark" },
            children: [{ type: "text", value: part }],
          } as Node);
        } else if (part !== "") {
          replacement.push({ type: "text", value: part } as Node);
        }
      });
      parent.children.splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
}
