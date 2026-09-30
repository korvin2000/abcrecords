import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { reportProblem } from "@/lib/diagnostics";

/**
 * The one guard against a blank page. React unmounts the whole tree when a
 * render throws and nothing catches it, and this app has three routes to that:
 * a rejected `lazy()` chunk (a hashed filename that no longer exists after a
 * deploy, a dropped request on a phone), a parse edge case in the `pages/`
 * content it fetches at runtime, and a bad prop. Hooks cannot catch — this
 * stays a class.
 *
 * Mounted twice: once under the providers in `main.tsx` (the whole app), once
 * around the codex in `App.tsx`, so an entry that will not open costs the
 * reader that entry rather than the grid behind it.
 */

interface Props {
  children: ReactNode;
  /** Replaces the children once a descendant has thrown. */
  fallback?: ReactNode;
  /** Names the boundary in the DEV console. */
  label?: string;
  /**
   * Change this to re-arm the boundary. The codex passes the open slug, so one
   * entry with unrenderable content does not keep the next one shut. Left unset
   * at the root, where only a reload can plausibly help.
   */
  resetKey?: string;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The fallback tells the reader; this tells us. A boundary that trips only
    // on somebody else's phone used to leave no trace anywhere
    // (lib/diagnostics — one console line, and a report where an endpoint is
    // configured).
    reportProblem(`boundary.${this.props.label ?? "app"}`, error);
    if (import.meta.env.DEV) console.error(info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ?? <CrashFallback />;
  }
}

/**
 * Root fallback — the same voice as App's `loadError` branch. The offer is a
 * reload, not a retry: re-rendering the tree that just threw would throw again
 * (React caches a rejected `lazy` payload for good), while a reload fetches the
 * current chunk manifest — which is exactly the stale-deploy case.
 */
function CrashFallback() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-xl text-burgundy-600">{t("app.crash")}</p>
        <button onClick={() => window.location.reload()} className="btn-rpg mt-5">
          {t("app.crashReload")}
        </button>
      </div>
    </div>
  );
}
