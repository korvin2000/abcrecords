import type { DemosceneHandle, DemosceneOptions } from './types';
import { Dialog } from './ui/Dialog';

/**
 * The demoscene without React, for hosts (or host *pages*) that are not a
 * React tree: a plain imperative handle with `open` / `close` / `update` /
 * `destroy`.
 *
 * A React host should prefer the default export, `DemosceneApp` — React then
 * owns the lifetime and teardown happens on unmount. Reach for this only when
 * there is no component to mount from.
 *
 * ```ts
 * const demo = createDemoscene({ locale: 'en' });
 * button.addEventListener('click', () => demo.open());
 * // later, when the host's language changes:
 * demo.update({ locale: 'ru' });
 * // and on teardown — nothing else releases the AudioContext:
 * demo.destroy();
 * ```
 */
export function createDemoscene(options: DemosceneOptions = {}): DemosceneHandle {
  const dialog = new Dialog(options);
  return {
    open: () => dialog.open(),
    close: () => dialog.close(),
    get isOpen() {
      return dialog.isOpen;
    },
    update: (o: DemosceneOptions) => dialog.update(o),
    destroy: () => dialog.destroy(),
  };
}

/**
 * Wire every `[data-demoscene]` element on the page to one shared instance.
 * Returns a teardown function.
 *
 * This exists for the standalone `<script>` build and the dev host. It is not
 * part of the React integration path — a React host has a click handler
 * already and should use `DemosceneApp`.
 */
export function autoWire(options: DemosceneOptions = {}): () => void {
  const demo = createDemoscene(options);
  const onClick = (e: Event) => {
    let t = e.target as Node | null;
    while (t && t !== document) {
      if (t instanceof Element && t.hasAttribute('data-demoscene')) {
        e.preventDefault();
        demo.open();
        return;
      }
      t = t.parentNode;
    }
  };
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('click', onClick);
    demo.destroy();
  };
}
