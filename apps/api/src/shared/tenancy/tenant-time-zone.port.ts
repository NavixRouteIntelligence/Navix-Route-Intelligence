/**
 * Fuso horário do tenant (ADR-0105), isolado da regra que o usa.
 *
 * Existe porque o **dia operacional** de uma rota é o dia de quem opera, não o
 * dia UTC: uma rota criada às 21h em São Paulo é de hoje para o motorista e de
 * amanhã para o relógio do servidor.
 */
export interface TenantTimeZoneReaderPort {
  /** IANA (`America/Sao_Paulo`). `'UTC'` quando o tenant não configurou. */
  findTimeZone(tenantId: string): Promise<string>;
}

export const TENANT_TIME_ZONE_READER = Symbol('TENANT_TIME_ZONE_READER');

/** Padrão de todo o sistema enquanto o tenant não escolhe outro. */
export const DEFAULT_TIME_ZONE = 'UTC';
