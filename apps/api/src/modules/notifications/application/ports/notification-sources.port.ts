/**
 * O que o módulo de notificações precisa saber e **não** possui (ADR-0084):
 * o contato do destinatário (Delivery) e o link de rastreio (PublicTracking).
 *
 * Declaradas na linguagem daqui e implementadas por gateways anti-corrupção —
 * mesmo padrão do `FleetGatewayPort`.
 */

/** Recorte mínimo da entrega para decidir e montar uma notificação. */
export interface NotifiableDelivery {
  id: string;
  recipient: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  latitude: number;
  longitude: number;
  /** Motorista responsável — usado para casar posição com entrega. */
  driverId: string | null;
  /** Status atual: o evento de domínio não o carrega. */
  status: string;
}

export interface DeliveryContactGatewayPort {
  find(tenantId: string, deliveryId: string): Promise<NotifiableDelivery | null>;
  /** Entregas ativas de um motorista — base do aviso "está chegando". */
  activeForDriver(tenantId: string, driverId: string): Promise<NotifiableDelivery[]>;
  /** Entregas ativas do tenant — alvo do aviso de atraso (que é por rota). */
  activePendingNotification(tenantId: string): Promise<NotifiableDelivery[]>;
  /** Última posição conhecida do motorista. */
  lastPositionOf(
    tenantId: string,
    driverId: string,
  ): Promise<{ latitude: number; longitude: number } | null>;
}

export const DELIVERY_CONTACT_GATEWAY = Symbol('DELIVERY_CONTACT_GATEWAY');

/**
 * Link público de rastreio. A emissão já é **idempotente** (ADR-0082):
 * notificar quatro vezes a mesma entrega reusa o mesmo link, então o
 * destinatário guarda um endereço só.
 */
export interface TrackingLinkGatewayPort {
  urlFor(tenantId: string, deliveryId: string): Promise<{ token: string; url: string }>;
}

export const TRACKING_LINK_GATEWAY = Symbol('TRACKING_LINK_GATEWAY');
