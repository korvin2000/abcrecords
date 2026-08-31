import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Feature name, for the log line. */
  name: string;
  /** Let the host close whatever surface hosted the feature. */
  onDismiss?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Host-owned failure boundary for a lazy feature (architecture guide §18).
 *
 * `React.lazy()` routes a rejected import promise to the nearest error
 * boundary, so this catches both kinds of failure that matter: the chunk not
 * arriving (a deploy landed while the tab was open — §30), and the feature
 * throwing once it has. Either way the encyclopedia keeps rendering.
 *
 * This belongs to the host, not to the feature: it exists so the host is
 * protected *from* the feature. `apps/encyclopedia` should have its own,
 * probably in `src/lib/FeatureBoundary.tsx` (§5), wired to real telemetry.
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    /* real host: report to telemetry, tagged with the feature name */
    console.error(`[${this.props.name}] feature failed to load or render`, error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="feature-error" role="alert">
        <p>The demoscene could not be loaded.</p>
        <button
          onClick={() => {
            this.setState({ error: null });
            this.props.onDismiss?.();
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }
}
