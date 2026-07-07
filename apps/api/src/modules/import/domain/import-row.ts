import type { ImportRowView } from '@navix/contracts';

export interface ResolvedAddress {
  street: string;
  number: string;
  complement: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Linha armazenada no lote: a visão pública (ImportRowView) + dados internos
 * necessários para criar a entrega na confirmação (endereço resolvido + chave
 * de deduplicação).
 */
export interface StoredImportRow extends ImportRowView {
  resolved: ResolvedAddress | null;
  dedupKey: string;
}
