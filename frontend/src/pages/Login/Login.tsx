import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { loginSchema, type LoginInput } from '@elite/shared';

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { getApiErrorMessage } from '@/lib/apiClient';
import { paths } from '@/routes/routes';

interface LocationState {
  from?: { pathname?: string };
}

export default function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? paths.home();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not sign you in. Check your details.'));
    }
  });

  return (
    <section className="en-container py-5">
      <div className="mx-auto" style={{ maxWidth: 460 }}>
        <div className="text-center mb-4">
          <span className="en-eyebrow d-block mb-2">Welcome back</span>
          <h1 className="en-display display-6 mb-2">Sign in</h1>
          <p className="en-text-dim mb-0">Fresh cuts, delivered. Sign in to continue.</p>
        </div>

        <div className="en-card en-card--raised p-4 p-lg-5">
          <form onSubmit={onSubmit} noValidate>
            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="phone" className="form-label">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                className={`form-control${errors.phone ? ' is-invalid' : ''}`}
                placeholder="9876543210"
                aria-invalid={errors.phone ? true : undefined}
                {...register('phone')}
              />
              {errors.phone && <div className="invalid-feedback">{errors.phone.message}</div>}
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`form-control${errors.password ? ' is-invalid' : ''}`}
                placeholder="••••••••"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
              {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
            </div>

            <Button type="submit" variant="gold" fullWidth isLoading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center en-text-dim mt-4 mb-0">
          New to Elite NonVeg?{' '}
          <Link
            to={paths.register()}
            state={location.state}
            className="en-link-reset"
            style={{ color: 'var(--en-gold)' }}
          >
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
