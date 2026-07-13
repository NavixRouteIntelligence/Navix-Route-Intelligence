import type {
  ResourceResponse,
  UpdateProfileRequest,
  UserProfile,
} from '@navix/contracts';

import { apiRequest } from './client';

/** Cliente do perfil do usuário (dados de identificação + avatar). */
export const profileApi = {
  get: () => apiRequest<ResourceResponse<UserProfile>>('/me/profile'),

  update: (patch: UpdateProfileRequest) =>
    apiRequest<ResourceResponse<UserProfile>>('/me/profile', { method: 'PATCH', body: patch }),

  setAvatar: (avatar: string) =>
    apiRequest<ResourceResponse<UserProfile>>('/me/profile/avatar', {
      method: 'PUT',
      body: { avatar },
    }),

  removeAvatar: () =>
    apiRequest<ResourceResponse<UserProfile>>('/me/profile/avatar', { method: 'DELETE' }),
};
