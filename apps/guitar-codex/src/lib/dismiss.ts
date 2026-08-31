import { useEffect, useRef, type RefObject } from "react";

/**
 * Light-dismiss for a popover: a pointer press outside it, or Escape, closes it.
 *
 * Escape is handled in the **capture** phase and its propagation is stopped, so
 * the innermost open popover closes first and the codex modal listening behind
 * it does not close as well. Every dismissable layer in the app must keep to
 * that convention — see `.claude-memory/14-app-patterns-and-gotchas.md`.
 *
 * Returns the ref to put on the element that owns *both* the trigger and the
 * panel; anchoring it to the panel alone makes a click on the trigger read as
 * "outside", which dismisses and re-opens in the same gesture.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    };

    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open, onDismiss]);

  return ref;
}
