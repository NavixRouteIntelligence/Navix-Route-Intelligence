import type {
  ResourceResponse,
  UpdateUserSettingsRequest,
  UserSettings,
} from '@navix/contracts';

import { apiRequest } from './client';

/** Cliente das preferências do usuário (Tema, Idioma, Preferências de UI). */
export const settingsApi = {
  get: () => apiRequest<ResourceResponse<UserSettings>>('/me/settings'),

  update: (patch: UpdateUserSettingsRequest) =>
    apiRequest<ResourceResponse<UserSettings>>('/me/settings', {
      method: 'PATCH',
      body: patch,
    }),
};
