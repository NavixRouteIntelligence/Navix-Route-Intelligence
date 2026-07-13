'use client';

import type { UpdateProfileRequest, UserProfile } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileApi } from '@/lib/api/profile';
import { useAuth } from '@/lib/auth/auth-provider';

export const PROFILE_QUERY_KEY = ['me', 'profile'] as const;

/** Lê o perfil do usuário do servidor. Só dispara quando autenticado. */
export function useProfile(): { profile: UserProfile | undefined; isLoading: boolean } {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => profileApi.get().then((r) => r.data),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
  return { profile: query.data, isLoading: query.isLoading };
}

/** Atualiza os campos do perfil. */
export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProfileRequest) => profileApi.update(patch).then((r) => r.data),
    onSuccess: (data) => client.setQueryData(PROFILE_QUERY_KEY, data),
  });
}

/** Define (data URL) ou remove (`null`) o avatar. */
export function useUpdateAvatar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (avatar: string | null) =>
      (avatar === null ? profileApi.removeAvatar() : profileApi.setAvatar(avatar)).then((r) => r.data),
    onSuccess: (data) => client.setQueryData(PROFILE_QUERY_KEY, data),
  });
}
