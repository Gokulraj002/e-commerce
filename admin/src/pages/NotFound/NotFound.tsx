import { Link } from 'react-router-dom';

import { ROUTES } from '@/routes/paths';

/** 404 fallback for unmatched routes. */
export default function NotFound() {
  return (
    <div className="center-fill text-center">
      <div>
        <div className="display-5 fw-bold text-danger">404</div>
        <p className="text-muted-2 mb-3">The page you are looking for does not exist.</p>
        <Link to={ROUTES.dashboard} className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
