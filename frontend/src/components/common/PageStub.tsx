import type { ReactNode } from 'react';

export interface PageStubProps {
  /** Page name shown as the heading. */
  name: string;
  /** One-line description of what this page will contain. */
  blurb?: string;
  /** Optional context (e.g. resolved route params) for the next agent. */
  meta?: ReactNode;
}

/**
 * Placeholder page shell used across all routes until real pages land.
 * The next wave of page agents replaces the body of each `pages/<Name>` file.
 */
export function PageStub({ name, blurb, meta }: PageStubProps): JSX.Element {
  return (
    <section className="en-container py-6">
      <div className="en-card p-4 p-lg-5 mx-auto" style={{ maxWidth: 760 }}>
        <span className="en-eyebrow d-block mb-2">Elite NonVeg</span>
        <h1 className="en-display display-6 mb-2">{name}</h1>
        <p className="en-text-dim mb-0">
          {blurb ?? 'This page is scaffolded and ready for its full implementation.'}
        </p>
        {meta && <div className="mt-4 pt-4 en-hairline border-0 border-top">{meta}</div>}
        <div className="en-divider my-4" />
        <p className="en-text-muted small mb-0">
          Placeholder — replace this stub with the full page. See FRONTEND_GUIDE.md.
        </p>
      </div>
    </section>
  );
}
