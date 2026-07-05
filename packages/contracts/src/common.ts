/**
 * Contratos comuns da API (envelopes de resposta, erros, paginação).
 * Alinhados a docs/api.md. Sem dependências de framework — tipos puros.
 */

/** Envelope de sucesso para um recurso único. */
export interface ResourceResponse<T> {
  data: T;
}

/** Metadados de paginação por página. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Links de navegação de coleção. */
export interface CollectionLinks {
  next: string | null;
  prev: string | null;
}

/** Envelope de sucesso para uma coleção paginada. */
export interface CollectionResponse<T> {
  data: T[];
  meta: PaginationMeta;
  links: CollectionLinks;
}

/** Detalhe de um erro de validação por campo. */
export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/** Códigos de erro padronizados (ver docs/api.md §7). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** Envelope de erro padronizado. Nunca vaza detalhes internos. */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

/** Prefixo de versão da API. */
export const API_VERSION = 'v1' as const;
