import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthContext';
import { CartProvider } from '@/features/cart/CartContext';
import { CartDrawerProvider } from '@/features/cart/CartDrawerContext';
import { CartFlyProvider } from '@/features/cart/useCartFly';
import { ServiceabilityProvider } from '@/features/serviceability';
import { queryClient } from '@/lib/queryClient';
import { AppRouter } from '@/routes/AppRouter';

import './styles/main.scss';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Safety net: after 800ms flag <body> ready so CSS can force-reveal any
// framer-motion `whileInView` sections that stalled at opacity 0 (e.g. when
// the viewport observer registers a section as offscreen at mount time).
window.setTimeout(() => document.body.classList.add('en-ready'), 800);

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ServiceabilityProvider>
              <CartProvider>
                <CartDrawerProvider>
                  <CartFlyProvider>
                    <AppRouter />
                  </CartFlyProvider>
                </CartDrawerProvider>
              </CartProvider>
            </ServiceabilityProvider>
          </AuthProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
