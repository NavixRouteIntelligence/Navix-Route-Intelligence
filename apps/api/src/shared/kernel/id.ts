import { v7 as uuidv7 } from 'uuid';

/**
 * Geração de identificadores. Usa UUIDv7 (ordenável por tempo) como PK padrão
 * para preservar locality de índice em escala (ver ADR-0008 em docs/decisions.md).
 */
export function newId(): string {
  return uuidv7();
}
