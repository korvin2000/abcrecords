import { visit } from "unist-util-visit";
import type { Node } from "unist";

interface ListNode extends Node {
  type: "list";
  ordered?: boolean | null;
  children: Node[];
  data?: { hProperties?: Record<string, unknown> };
}

/**
 * remark plugin for BioMD's source-faithful ordered-list markers (spec 3.4):
 * a list written `01.` / `02.` keeps its marker width.
 *
 * remark normalises `01` to the number 1, so the padding survives only in the
 * source. It is recovered from the first item's offset and handed to CSS
 * (`.bio-ol-zero` → `list-style-type: decimal-leading-zero`) rather than being
 * rendered as text, so copy, `start`, and screen readers stay correct.
 */
export function remarkZeroPaddedLists() {
  return (tree: Node, file: { value?: unknown }) => {
    const source = typeof file?.value === "string" ? file.value : String(file);
    visit(tree, "list", (node: ListNode) => {
      if (!node.ordered) return;
      const offset = node.children[0]?.position?.start.offset;
      if (offset === undefined || !/^0\d/.test(source.slice(offset, offset + 4))) return;
      const data = (node.data ??= {});
      const props = (data.hProperties ??= {});
      props.className = "bio-ol-zero";
    });
  };
}
