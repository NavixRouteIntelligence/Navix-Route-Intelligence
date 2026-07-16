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
  /** **Referência** estável do objeto (a *storage key*) — é o que fica no banco. */
  ref: string;
}

export interface StoragePort {
  save(input: StorageSaveInput): Promise<StoredMedia>;
  /**
   * URL **assinada e expirável** para ler o objeto (ADR-0046): presigned GET no
   * S3; URL HMAC + `exp` servida pelo `FilesController` no driver local. Gerada
   * no *read* — evita URLs públicas permanentes para mídia de PII.
   */
  readUrl(ref: string): Promise<string>;
  /** Remoção best-effort (ex.: limpeza de órfãos), pela referência. */
  delete(ref: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');

/** Chave determinística do objeto: `scope/tenant/id-field.ext`. */
export function storageKey(input: StorageSaveInput): string {
  return `${input.scope}/${input.tenantId}/${input.id}-${input.field}.${input.extension}`;
}
