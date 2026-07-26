import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Conservative defaults tuned for an admin panel:
 * data is considered fresh for 30s, retried once, and not refetched on window
 * focus (admins tab-switch constantly). Mutations never retry by default.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
