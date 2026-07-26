import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { staffLoginSchema, useAuth, type StaffLoginInput } from '@/features/auth';
import { TextField, useToast } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import { ROUTES } from '@/routes/paths';

interface LocationState {
  from?: { pathname: string };
}

/** Staff sign-in. Redirects to the intended page (or dashboard) on success. */
export default function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StaffLoginInput>({ resolver: zodResolver(staffLoginSchema) });

  if (status === 'authenticated') {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await login(values);
      const dest = (location.state as LocationState | null)?.from?.pathname ?? ROUTES.dashboard;
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error({ title: 'Sign in failed', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="app-sidebar__mark" style={{ width: 34, height: 34 }}>
            E
          </span>
          <div>
            <div className="fw-bold">Elite NonVeg</div>
            <div className="text-muted-2 small">Admin panel</div>
          </div>
        </div>

        <h1 className="h5 fw-bold mb-1">Sign in</h1>
        <p className="text-muted-2 small mb-4">Use your staff credentials to continue.</p>

        <form onSubmit={onSubmit} noValidate>
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="you@elitenonveg.com"
            required
            error={errors.email}
            {...register('email')}
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            error={errors.password}
            {...register('password')}
          />
          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
