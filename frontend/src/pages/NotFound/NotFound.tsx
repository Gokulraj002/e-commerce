import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui';
import { paths } from '@/routes/routes';

export default function NotFound(): JSX.Element {
  return (
    <section className="en-container py-8">
      <EmptyState
        icon="🔎"
        title="Page not found"
        description="The page you are looking for has moved or never existed."
        action={
          <Link to={paths.home()} className="btn btn-gold">
            Back to home
          </Link>
        }
      />
    </section>
  );
}
