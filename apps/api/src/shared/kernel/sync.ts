import type { SyncMeta, SyncParams } from '@navix/contracts';
import { SYNC_DEFAULT_LIMIT, SYNC_MAX_LIMIT } from '@navix/contracts';

import { ValidationError } from './domain-error';

/**
 * Sincronização incremental (offline-first). Helpers de **cursor de keyset** e de
 * normalização de parâmetros, compartilhados por qualquer recurso "sincronizável".
 *
 * O cursor é opaco para o cliente: um par `(updatedAt, id)` codificado em
 * base64url. A ordenação canônica é `(updated_at ASC, id ASC)`, o que torna a
 * paginação estável e barata mesmo em coleções grandes (keyset, não offset).
 * Ver ADR-0020 e docs/api.md §8.1.
 */

/** Posição de keyset: a última linha `(updatedAt, id)` entregue. */
export interface SyncCursor {
  updatedAt: Date;
  id: string;
}

/** Parâmetros normalizados de sincronização, prontos para o repositório. */
export interface NormalizedSync {
  /** Marca d'água (primeira página da rodada). Ausente quando há `cursor`. */
  since?: Date;
  /** Posição de keyset (páginas seguintes). Tem precedência sobre `since`. */
  cursor?: SyncCursor;
  /** Tamanho de página já limitado a [1, SYNC_MAX_LIMIT]. */
  limit: number;
}

/** Codifica `(updatedAt, id)` como cursor opaco (base64url). */
export function encodeCursor(cursor: SyncCursor): string {
  const payload = JSON.stringify({ t: cursor.updatedAt.toISOString(), i: cursor.id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** Decodifica um cursor opaco; lança `ValidationError` se malformado. */
export function decodeCursor(raw: string): SyncCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('Cursor de sincronização inválido.');
  }
  const obj = parsed as { t?: unknown; i?: unknown };
  if (typeof obj.t !== 'string' || typeof obj.i !== 'string') {
    throw new ValidationError('Cursor de sincronização inválido.');
  }
  const updatedAt = new Date(obj.t);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new ValidationError('Cursor de sincronização inválido.');
  }
  return { updatedAt, id: obj.i };
}

/**
 * Normaliza os parâmetros do cliente. `cursor` tem precedência sobre
 * `updatedSince` (a rodada continua de onde parou); sem nenhum dos dois, é um
 * sync completo inicial (tudo, paginado por keyset).
 */
export function normalizeSync(params: SyncParams): NormalizedSync {
  const limit = clampLimit(params.limit);
  if (params.cursor) {
    return { cursor: decodeCursor(params.cursor), limit };
  }
  if (params.updatedSince) {
    const since = new Date(params.updatedSince);
    if (Number.isNaN(since.getTime())) {
      throw new ValidationError('Parâmetro `updatedSince` inválido (esperado ISO 8601).');
    }
    return { since, limit };
  }
  return { limit };
}

/**
 * Monta os metadados do envelope de sync. `items` é a página **já limitada** ao
 * `limit`; `hasMore` indica se havia mais linhas (o repositório busca `limit + 1`).
 */
export function buildSyncMeta(
  last: SyncCursor | null,
  limit: number,
  hasMore: boolean,
): SyncMeta {
  return {
    syncedAt: new Date().toISOString(),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    hasMore,
    limit,
  };
}

function clampLimit(raw?: number): number {
  if (!Number.isFinite(raw) || (raw as number) < 1) return SYNC_DEFAULT_LIMIT;
  return Math.min(Math.floor(raw as number), SYNC_MAX_LIMIT);
}
