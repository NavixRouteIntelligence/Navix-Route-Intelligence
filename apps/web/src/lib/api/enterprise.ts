import type {
  ResourceResponse,
  TenantBranding,
  TenantBrandingAdmin,
  UpdateTenantBrandingRequest,
} from '@navix/contracts';

import { apiRequest, toQuery } from './client';

export const enterpriseApi = {
  resolveBranding: (host: string) =>
    apiRequest<ResourceResponse<TenantBranding | null>>(
      `/public/enterprise/branding/resolve${toQuery({ host })}`,
      { auth: false },
    ),

  getBranding: () => apiRequest<ResourceResponse<TenantBrandingAdmin>>('/enterprise/branding'),

  updateBranding: (patch: UpdateTenantBrandingRequest) =>
    apiRequest<ResourceResponse<TenantBrandingAdmin>>('/enterprise/branding', {
      method: 'PATCH',
      body: patch,
    }),

  verifyDomain: () =>
    apiRequest<ResourceResponse<TenantBrandingAdmin>>('/enterprise/branding/domain/verify', {
      method: 'POST',
    }),
};
