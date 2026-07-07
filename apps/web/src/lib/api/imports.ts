import type {
  CollectionResponse,
  ConfirmImportRequest,
  ConfirmImportResponse,
  ImportBatchView,
  ImportPreviewResponse,
} from '@navix/contracts';

import { apiRequest, apiUpload, toQuery } from './client';

export interface ImportListParams {
  page?: number;
  pageSize?: number;
}

export const importsApi = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<ImportPreviewResponse>('/imports/preview', form);
  },
  confirm: (id: string, body: ConfirmImportRequest = {}) =>
    apiRequest<ConfirmImportResponse>(`/imports/${id}/confirm`, { method: 'POST', body }),
  list: (params: ImportListParams = {}) =>
    apiRequest<CollectionResponse<ImportBatchView>>(`/imports${toQuery({ ...params })}`),
  get: (id: string) => apiRequest<ImportPreviewResponse>(`/imports/${id}`),
};
