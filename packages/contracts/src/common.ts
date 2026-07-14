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

/**
 * Sincronização incremental (offline-first).
 *
 * Em vez de re-baixar a coleção inteira, o cliente pede apenas o que mudou desde
 * o último sync. A primeira página de uma "rodada" usa `updatedSince` (a marca
 * d'água do cliente); as páginas seguintes usam o `cursor` opaco devolvido pelo
 * servidor (keyset em `(updatedAt, id)` — estável e barato mesmo em coleções
 * grandes). Registros excluídos voltam como **tombstones** (`deletedAt != null`)
 * para o cache local removê-los. Ver docs/api.md §8.1 e ADR-0020.
 */
export interface SyncParams {
  /** Marca d'água ISO 8601: só o que mudou em/depois deste instante. */
  updatedSince?: string;
  /** Cursor opaco de keyset; continua a rodada de onde parou (tem precedência). */
  cursor?: string;
  /** Tamanho da página do delta. */
  limit?: number;
}

/** Metadados de uma resposta de sincronização incremental. */
export interface SyncMeta {
  /** Relógio do servidor no início da resposta; o cliente guarda como próximo `updatedSince`. */
  syncedAt: string;
  /** Cursor para a próxima página da rodada; `null` quando não há mais deltas. */
  nextCursor: string | null;
  /** Há mais páginas nesta rodada (use `nextCursor`). */
  hasMore: boolean;
  /** Tamanho de página efetivamente aplicado. */
  limit: number;
}

/** Envelope de resposta de sincronização incremental (mudanças + tombstones). */
export interface SyncResponse<T> {
  data: T[];
  meta: SyncMeta;
}

/** Limites de página do sync incremental (alinhados ao backend). */
export const SYNC_DEFAULT_LIMIT = 100;
export const SYNC_MAX_LIMIT = 500;

/** Prefixo de versão da API. */
export const API_VERSION = 'v1' as const;
