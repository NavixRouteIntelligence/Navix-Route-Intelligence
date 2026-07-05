/**
 * Porta de auditoria (append-only). Registra quem fez o quê, em qual tenant.
 * Grava na tabela imutável `audit_log` (ver docs/security.md §7.1).
 */
export interface AuditEntry {
  tenantId: string;
  actorId: string | null;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogPort {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol('AUDIT_LOG');
