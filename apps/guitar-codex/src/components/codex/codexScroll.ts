import { createContext, useContext } from "react";

/**
 * The codex's reading pane is owned by `CodexShell`, but the tab strip — two
 * levels down — has to return it to the top on a tab switch. A one-value
 * context is lighter than threading a ref through every view.
 */
const CodexScrollContext = createContext<() => void>(() => {});

export const CodexScrollProvider = CodexScrollContext.Provider;

/** Scroll the codex's reading pane back to the top. */
export function useCodexScroll(): () => void {
  return useContext(CodexScrollContext);
}
