import { useMemo } from "react";
import { parseBioMd, type BioDoc } from "./parse";

/**
 * The parsed article, read once per edition.
 *
 * The parse is lifted out of the renderer because the codex needs it *above*
 * the article too: the plate decides its own title lines from the document's
 * (see headings.ts), and parsing the same source twice to answer one question
 * is exactly the kind of waste this app is engineered against.
 */
export function useBioDoc(source: string | null | undefined): BioDoc | null {
  return useMemo(() => (source ? parseBioMd(source) : null), [source]);
}
