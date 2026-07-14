/**
 * Abstração de armazenamento de objetos (mídia) — o `StorageService`. Move as
 * imagens do POD para **fora do PostgreSQL** (disco em dev; S3/R2/GCS em
 * produção) e devolve a **URL** que é o que fica salvo no banco. Ver ADR-0019.
 */
export interface StorageSaveInput {
  /** Namespace do recurso (ex.: `pod`). */
  scope: string;
  tenantId: string;
  /** Id do agregado dono (ex.: podId). */
  id: string;
  /** Campo (ex.: `photo`, `signature`). */
  field: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
}

export interface StoredMedia {
  /** URL pública/servível do objeto — é o que se persiste no banco. */
  url: string;
}

export interface StoragePort {
  save(input: StorageSaveInput): Promise<StoredMedia>;
  /** Remoção best-effort (ex.: limpeza de órfãos). */
  delete(url: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');

/** Chave determinística do objeto: `scope/tenant/id-field.ext`. */
export function storageKey(input: StorageSaveInput): string {
  return `${input.scope}/${input.tenantId}/${input.id}-${input.field}.${input.extension}`;
}
