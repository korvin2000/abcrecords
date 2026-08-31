/**
 * The public contract of `@site/demoscene`.
 *
 * Everything in this file is part of the integration surface the host app is
 * allowed to depend on. Everything else under `src/` is private
 * implementation and may change without notice — see the package README.
 *
 * Contract rules (architecture guide §12): primitives, plain serializable
 * objects and stable callbacks only. No host stores, no router instances, no
 * host contexts, no mutable host objects cross this boundary.
 *
 * Every user-visible string is a `LocalizedText`: either a plain string (used
 * for every locale) or a map of locale tag -> string. Nothing else in the
 * package needs to know that localisation exists; `resolveContent` flattens a
 * `DemosceneContent` into a `ResolvedContent` once, at bake time.
 */

/** A string, or a per-locale map such as `{ en: 'About', ru: 'О программе' }`. */
export type LocalizedText = string | Readonly<Record<string, string>>;

export interface CreditGroup {
  /** Rubricated heading, e.g. `PROJECT CREATOR`. */
  role: LocalizedText;
  /** Italic gloss under the heading, e.g. `Doctor of Philosophy`. */
  sub?: LocalizedText;
  /** People. Usually the same in every locale, but may be localized. */
  names: readonly LocalizedText[];
}

/** Every piece of copy the demoscene itself renders. */
export interface DemosceneContent {
  /** Large title on the credit roll and on the rose-vault cartouche. */
  work: LocalizedText;
  /** Dialog heading and title card. */
  title: LocalizedText;
  subtitle: LocalizedText;
  edition: LocalizedText;
  /** The illuminated initial. One character. */
  dropcap: LocalizedText;
  dedication: LocalizedText;
  colophon: LocalizedText;
  credits: readonly CreditGroup[];
  /**
   * Short phrases shown one at a time at the foot of the page, drifting in
   * out of the mist and back out again. Keep each under ~70 characters.
   */
  blocks: readonly LocalizedText[];
}

/** Labels for the demoscene's own chrome (buttons, hint line, ARIA names). */
export interface DemosceneMessages {
  music: string;
  musicOn: string;
  text: string;
  restart: string;
  close: string;
  hint: string;
  canvasLabel: string;
  dialogLabel: string;
}

/**
 * Options for the imperative mount (`createDemoscene`). The React component
 * takes the same fields as props — see `DemosceneProps`.
 */
export interface DemosceneOptions {
  /**
   * The language to render in. A BCP-47-ish tag; `ru-RU` falls back to `ru`,
   * then to `fallbackLocale`, then to the first shipped locale. This is the
   * one field a host almost always passes.
   */
  locale?: string;
  /** Default `'en'`. */
  fallbackLocale?: string;
  /** Deep-merged over the built-in content. Omit to use the shipped copy. */
  content?: Partial<DemosceneContent>;
  /** Extra or overriding chrome labels, keyed by locale tag. */
  messages?: Readonly<Record<string, Partial<DemosceneMessages>>>;
  /** Start the score when the demoscene opens. Ignored under reduced motion. */
  autoMusic?: boolean;
  /** 0..1, default 0.62. */
  volume?: number;
  /** Device-pixel-ratio ceiling, default 1.6. */
  maxDpr?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Props of the default export, `DemosceneApp`.
 *
 * `open` is controlled by the host: the component is a pure function of it.
 * `onClose` fires only on a *user-initiated* close (Esc, the scrim, the Close
 * button) — never on unmount, and never in response to the host setting
 * `open` itself, so a controlled parent cannot feed itself back a change.
 */
export interface DemosceneProps extends Omit<DemosceneOptions, 'onOpen' | 'onClose'> {
  /** Controlled visibility. */
  open: boolean;
  /** The user asked to close. Set your `open` state to false here. */
  onClose?: () => void;
  /** The demoscene finished opening. Informational; telemetry hook. */
  onOpen?: () => void;
}

/** Content with every `LocalizedText` collapsed for one locale. */
export interface ResolvedContent {
  work: string;
  title: string;
  subtitle: string;
  edition: string;
  dropcap: string;
  dedication: string;
  colophon: string;
  credits: { role: string; sub: string; names: string[] }[];
  blocks: string[];
}

/** What `createDemoscene` hands back — the non-React mount. */
export interface DemosceneHandle {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  /** Swap locale and/or content; re-bakes the bitmaps on the next open. */
  update(options: DemosceneOptions): void;
  /** Remove the DOM, listeners, timers and AudioContext. */
  destroy(): void;
}
