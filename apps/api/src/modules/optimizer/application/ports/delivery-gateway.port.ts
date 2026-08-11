import type { DeliveryPriority, DestinationType, TimeWindow } from '@navix/contracts';

import type { DeliveryOwnership } from '../../domain/delivery-ownership';

export interface OptimizerDeliveryStop {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
  /** Tipo do destino classificado a partir do endereço (ADR-0064). */
  destinationType?: DestinationType;
  /**
   * Demanda real da entrega (ADR-0109). `null` quando não informada; o caso de
   * uso conta a ausência como zero e declara no plano quantas foram assim.
   */
  weightKg: number | null;
  volumeM3: number | null;
  /** Veículo atribuído — a origem da capacidade da rota (ADR-0109). */
  vehicleId: string | null;
}

/**
 * Parada como a tela da rota precisa dela: endereço, estado e localização.
 *
 * Separada de [OptimizerDeliveryStop] porque serve outra pergunta. O motor
 * precisa de coordenadas e demanda; a tela precisa de morada e estado — e
 * `latitude`/`longitude` aqui são **nulos quando a entrega não tem localização
 * utilizável**, em vez de zero, que apontaria para o golfo da Guiné.
 */
export interface RouteViewDeliveryStop {
  id: string;
  addressText: string | null;
  status: string;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Porta anti-corrupção do Optimizer para o contexto Delivery. O adaptador na
 * infraestrutura delega para a API pública do Delivery (DeliveryLookup).
 */
export interface DeliveryGatewayPort {
  getStops(tenantId: string, ids: string[]): Promise<OptimizerDeliveryStop[]>;
  /**
   * As entregas **exatamente destes ids** (ADR-0127), para a vista da rota.
   *
   * Por ids, e nunca por página: o app juntava o plano a uma página de 100
   * entregas ordenadas por criação, e uma parada fora dessa página perdia
   * morada e estado sem nada a assinalar.
   */
  getRouteStops(tenantId: string, ids: string[]): Promise<RouteViewDeliveryStop[]>;
  /**
   * A quem pertence cada entrega pedida (ADR-0099). Só as visíveis no tenant —
   * a diferença entre o pedido e o devolvido é significado do chamador.
   */
  getOwnership(tenantId: string, ids: string[]): Promise<DeliveryOwnership[]>;
  /** Entregas ativas do tenant (para reotimização automática — ADR-0023). */
  listActiveStops(tenantId: string): Promise<OptimizerDeliveryStop[]>;
}

export const DELIVERY_GATEWAY = Symbol('DELIVERY_GATEWAY');
