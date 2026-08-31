import Demoscene from "@site/demoscene";
import type { Lang } from "@/lib/languages";

/**
 * The host's connecting point to `@site/demoscene` — the About/credits
 * production behind the `I` button in the top bar.
 *
 * The `import Demoscene from "@site/demoscene"` above is static, and that is
 * correct: *this module* is only ever reached through `LazyAboutDemoscene`'s
 * dynamic import, so the renderer, the score and the eleven message catalogues
 * ride in that async chunk. The mistake the architecture guards against is the
 * same import appearing in startup code — App.tsx, main.tsx, a barrel one of
 * them reads — which would put all of it in the initial bundle with nothing
 * visibly wrong to show for it (docs/react-modular-architecture.md §34.1, and
 * docs/demoscene-integration.md §11, which calls it "the single most damaging
 * mistake anyone can make here").
 *
 * If eager code ever needs to know which languages the demoscene speaks, the
 * package has a few-byte subpath export for exactly that:
 * `import { SUPPORTED_LOCALES } from "@site/demoscene/locales"`.
 *
 * The whole integration surface is three props. Everything it draws lives in
 * its own shadow root, so it cannot inherit this app's tokens and its
 * `:host{all:initial}` reset cannot escape into the catalogue (the package's
 * documented deviation, §10.1). It renders `null` into the React tree and
 * mounts its own element on `document.body`; unmounting releases the rAF loop,
 * the row timer, the `AudioContext`, every listener and the body scroll lock,
 * so the host has nothing to clean up (§7).
 */

interface Props {
  /** The reader's tongue. All eleven the codex speaks are shipped by the
   *  package, so this always resolves to a real catalogue — and an unmatched
   *  tag would fall through to English rather than render blank. */
  locale: Lang;
  /**
   * Fired only on a close the *reader* asked for — never on unmount, and never
   * because the host set `open` itself, so a controlled parent cannot feed
   * itself back a change under StrictMode. Memoise it: `DemosceneApp` rebuilds
   * its production when its options change by identity (§3.1).
   */
  onClose: () => void;
}

export function AboutDemoscene({ locale, onClose }: Props) {
  return <Demoscene open locale={locale} onClose={onClose} />;
}
