'use client';

import { DEFAULT_USER_SETTINGS, type UpdateUserSettingsRequest, type UserSettings } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/lib/api/settings';
import { useAuth } from '@/lib/auth/auth-provider';

export const SETTINGS_QUERY_KEY = ['me', 'settings'] as const;

/**
 * Lê as preferências do usuário do servidor (fonte de verdade sincronizada).
 * Só dispara quando autenticado; enquanto carrega, expõe os defaults.
 */
export function useSettings(): { settings: UserSettings; isLoading: boolean } {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => settingsApi.get().then((r) => r.data),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
  return { settings: query.data ?? DEFAULT_USER_SETTINGS, isLoading: query.isLoading };
}

/**
 * Persiste um patch parcial no servidor com atualização otimista do cache.
 * Em erro, reverte para o valor anterior.
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateUserSettingsRequest) => settingsApi.update(patch).then((r) => r.data),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = client.getQueryData<UserSettings>(SETTINGS_QUERY_KEY);
      const base = previous ?? DEFAULT_USER_SETTINGS;
      client.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, { ...base, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) client.setQueryData(SETTINGS_QUERY_KEY, context.previous);
    },
    onSuccess: (data) => {
      client.setQueryData(SETTINGS_QUERY_KEY, data);
    },
  });
}
