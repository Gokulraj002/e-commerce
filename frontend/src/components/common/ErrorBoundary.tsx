/**
 * Top-level error boundary for the customer app.
 *
 * Wraps the entire render tree in `main.tsx` and shows a friendly, dark-themed
 * full-page fallback when a descendant throws. The fallback offers two
 * recovery actions: reload the app (`Try again`) or navigate to home.
 *
 * React's router already handles route-level throws via `RouteError`; this
 * boundary catches everything above the router (providers) or anything the
 * router did not surface.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to the console so it surfaces in dev tools + any log-forwarder.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.assign('/');
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          background: 'var(--en-bg)',
          color: 'var(--en-text)',
          fontFamily: 'var(--en-font-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'var(--en-surface)',
            border: '1px solid var(--en-border)',
            borderRadius: 'var(--en-radius-lg)',
            boxShadow: 'var(--en-shadow-lg)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden
            style={{
              fontSize: '2.75rem',
              lineHeight: 1,
              marginBottom: '1rem',
              opacity: 0.85,
            }}
          >
            ⚠️
          </div>
          <p
            style={{
              fontFamily: 'var(--en-font-body)',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--en-gold)',
              margin: '0 0 0.75rem',
            }}
          >
            Something broke
          </p>
          <h1
            style={{
              fontFamily: 'var(--en-font-display)',
              fontWeight: 700,
              fontSize: '1.75rem',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              margin: '0 0 0.75rem',
            }}
          >
            We hit an unexpected error
          </h1>
          <p style={{ color: 'var(--en-text-dim)', margin: '0 0 1.5rem', fontSize: '1rem' }}>
            The kitchen ran into a problem loading this view. Try again — most of the time it
            clears right up. If it keeps happening, head back home.
          </p>

          {this.state.error?.message && (
            <pre
              style={{
                textAlign: 'left',
                background: 'var(--en-surface-raised)',
                border: '1px solid var(--en-border)',
                borderRadius: 'var(--en-radius)',
                padding: '0.75rem 1rem',
                color: 'var(--en-text-dim)',
                fontSize: '0.8125rem',
                overflow: 'auto',
                maxHeight: 140,
                margin: '0 0 1.5rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={this.handleReload}
              className="btn btn-gold"
              style={{ minWidth: 140 }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="btn btn-outline-cream"
              style={{ minWidth: 140 }}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
