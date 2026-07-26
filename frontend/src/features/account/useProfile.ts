/**
 * Profile query + update mutation. On success the mutation refreshes the
 * cache and mirrors the new user into the auth store so the header/greeting
 * stay in sync everywhere.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UserDTO } from '@elite/shared';

import { authStore } from '@/features/auth/authStore';
import { useAuth } from '@/features/auth/useAuth';

import { fetchProfile, updateProfile, type UpdateProfileInput } from './profile.api';

export const PROFILE_QUERY_KEY = ['profile'] as const;

export function useProfile() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    enabled: isAuthenticated,
    initialData: user ?? undefined,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (updated: UserDTO) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
      authStore.setUser(updated);
    },
  });
}
