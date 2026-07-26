import type { DeliveryStatus } from './delivery';

/**
 * Rastreamento público da entrega (ADR-0082) — o que o **destinatário** vê em
 * `track.navix.pt/<token>`, sem conta e sem login.
 *
 * ## Regra de PII deste contrato
 *
 * Quem tem o link é o destinatário: ele já sabe o próprio endereço e o próprio
 * nome. Então este payload **não repete** nada disso, e assim um link vazado
 * (encaminhado, indexado, num print) não entrega dado pessoal a terceiros.
 *
 * **Fora daqui, deliberadamente:** endereço, nome do destinatário, observações
 * da entrega (texto livre — pode conter qualquer coisa), nome/telefone do
 * motorista, e todo identificador interno (deliveryId, tenantId, driverId).
 */
export interface PublicTrackingView {
  /** Status da entrega. É o mesmo vocabulário do domínio. */
  status: DeliveryStatus;

  /**
   * Estimativa de chegada em ISO-8601, ou `null` quando não há rota preparada
   * (ou a entrega já terminou).
   *
   * **Heurística nesta fase:** deriva do plano de rota vigente
   * (`criadoEm + etaMinutes` da parada). Não considera trânsito em tempo real —
   * o modelo real chega na Fase 3 (ML de ETA). Ver `etaIsEstimate`.
   */
  estimatedArrival: string | null;

  /** Sempre `true` nesta fase: sinaliza à UI que o ETA é estimativa grosseira. */
  etaIsEstimate: boolean;

  /**
   * Posição do veículo, **apenas** enquanto `status === 'in_route'`.
   *
   * Fora da rota (pendente, entregue, cancelada) é `null` — rastrear um
   * motorista fora da janela de entrega seria vigilância, não serviço.
   */
  vehiclePosition: PublicVehiclePosition | null;

  /** Posição da parada de destino, para centrar o mapa. */
  destination: PublicGeoPoint | null;

  /** Quando esta informação foi apurada (ISO-8601). */
  updatedAt: string;
}

export interface PublicVehiclePosition extends PublicGeoPoint {
  /** Momento da última posição recebida (ISO-8601). */
  recordedAt: string;
}

export interface PublicGeoPoint {
  latitude: number;
  longitude: number;
}

/** Resposta ao emitir (ou reemitir) o link público de uma entrega. */
export interface TrackingLinkResponse {
  token: string;
  /** URL completa pronta para enviar ao destinatário. */
  url: string;
}
