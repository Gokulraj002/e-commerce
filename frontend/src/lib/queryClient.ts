/**
 * TanStack Query client with sane defaults for a storefront:
 *  - data considered fresh for 60s (catalog changes are not second-by-second)
 *  - one retry, no refetch-on-focus thrash
 *  - 401s should not be retried (the axios layer already handles refresh)
 */
import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
