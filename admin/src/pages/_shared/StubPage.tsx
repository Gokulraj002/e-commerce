import type { ReactNode } from 'react';

import { PageHeader } from '@/components/ui';

interface StubPageProps {
  name: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Placeholder scaffold for pages the next wave of agents will implement. Keeps
 * routing wired and the header consistent while the body is a "coming soon"
 * card. Replace the whole page file when building out the real feature.
 */
export function StubPage({ name, description, actions }: StubPageProps) {
  return (
    <>
      <PageHeader title={name} subtitle={description} actions={actions} />
      <div className="card">
        <div className="card-body text-center text-muted-2 py-5">
          <div className="fw-semibold mb-1">{name}</div>
          <div className="small">This page is a placeholder. Implementation pending.</div>
        </div>
      </div>
    </>
  );
}
