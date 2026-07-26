import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { EmptyState } from '@/components/ui';
import { paths } from '@/routes/routes';

/** Fallback shown when a route loader/render throws. */
export function RouteError(): JSX.Element {
  const error = useRouteError();
  const title = isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : 'Something broke';

  return (
    <section className="en-container py-8">
      <EmptyState
        icon="⚠️"
        title={title}
        description="An unexpected error occurred. Please try again."
        action={
          <Link to={paths.home()} className="btn btn-gold">
            Back to home
          </Link>
        }
      />
    </section>
  );
}
