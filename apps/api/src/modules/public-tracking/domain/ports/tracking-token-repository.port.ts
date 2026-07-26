/** Vínculo resolvido a partir de um token público. Sem PII por construção. */
export interface TrackingTokenRef {
  deliveryId: string;
  tenantId: string;
}

/**
 * Port dos tokens públicos de rastreamento (ADR-0082).
 *
 * Diferente dos demais repositórios do módulo, `resolve` **não é escopado por
 * tenant** — é justamente ele que descobre o tenant, a partir de um request
 * sem autenticação. Por isso devolve só identificadores: quem chama abre a
 * transação de tenant e lê a entrega sob RLS.
 */
export interface TrackingTokenRepositoryPort {
  /** Token vigente (não revogado) → vínculo. `null` se inválido ou revogado. */
  resolve(token: string): Promise<TrackingTokenRef | null>;

  /** Token vigente da entrega, se já houver. */
  findActiveByDelivery(tenantId: string, deliveryId: string): Promise<string | null>;

  /** Persiste um token novo para a entrega. */
  issue(token: string, tenantId: string, deliveryId: string): Promise<void>;
}

export const TRACKING_TOKEN_REPOSITORY = Symbol('TRACKING_TOKEN_REPOSITORY');
