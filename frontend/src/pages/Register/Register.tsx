import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { registerSchema, type RegisterInput } from '@elite/shared';

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { getApiErrorMessage } from '@/lib/apiClient';
import { paths } from '@/routes/routes';

interface LocationState {
  from?: { pathname?: string };
}

/**
 * Form-level schema: an empty email string is allowed (the field is optional)
 * and normalised to omitted on submit. Name/phone/password reuse the shared
 * rules so validation stays in one place.
 */
const registerFormSchema = registerSchema.extend({
  email: registerSchema.shape.email.or(z.literal('')),
});
type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function Register(): JSX.Element {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? paths.home();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', phone: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email?.trim();
    const payload: RegisterInput = {
      name: values.name,
      phone: values.phone,
      password: values.password,
      ...(email ? { email } : {}),
    };
    try {
      await registerUser(payload);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Could not create your account.'));
    }
  });

  return (
    <section className="en-container py-5">
      <div className="mx-auto" style={{ maxWidth: 460 }}>
        <div className="text-center mb-4">
          <span className="en-eyebrow d-block mb-2">Join Elite NonVeg</span>
          <h1 className="en-display display-6 mb-2">Create your account</h1>
          <p className="en-text-dim mb-0">Premium fresh meat, delivered across Hyderabad.</p>
        </div>

        <div className="en-card en-card--raised p-4 p-lg-5">
          <form onSubmit={onSubmit} noValidate>
            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className={`form-control${errors.name ? ' is-invalid' : ''}`}
                placeholder="Aarav Sharma"
                aria-invalid={errors.name ? true : undefined}
                {...register('name')}
              />
              {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
            </div>

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

            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email <span className="en-text-muted">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`form-control${errors.email ? ' is-invalid' : ''}`}
                placeholder="you@example.com"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className={`form-control${errors.password ? ' is-invalid' : ''}`}
                placeholder="At least 8 characters"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
              {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
            </div>

            <Button type="submit" variant="gold" fullWidth isLoading={isSubmitting}>
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center en-text-dim mt-4 mb-0">
          Already have an account?{' '}
          <Link
            to={paths.login()}
            state={location.state}
            className="en-link-reset"
            style={{ color: 'var(--en-gold)' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
