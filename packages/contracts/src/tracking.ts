/**
 * Contratos do módulo Tracking (MVP). Rastreamento de posição do motorista.
 * Preparado para ETA, otimização dinâmica e notificações em fases futuras.
 */

/**
 * Estado operacional do motorista no rastreamento:
 * - `offline`: sem atualização recente de posição.
 * - `en_route`: em rota, enviando posição.
 * - `finished`: rota concluída.
 */
export type TrackingStatus = 'offline' | 'en_route' | 'finished';

/** Atualização de posição enviada pelo dispositivo do motorista. */
export interface PositionUpdateRequest {
  latitude: number;
  longitude: number;
  /** ISO 8601. Se ausente, o servidor usa o horário de recebimento. */
  recordedAt?: string;
  /** Velocidade em km/h. */
  speed?: number | null;
  /** Direção em graus (0–359, 0 = Norte). */
  heading?: number | null;
  /** Estado reportado; `offline` é derivado pelo servidor por inatividade. */
  status?: Exclude<TrackingStatus, 'offline'>;
}

/**
 * Envio **em lote** de posições (sincronização offline): o dispositivo acumula
 * posições sem sinal e as envia numa única requisição ao reconectar. Ver
 * `POST /tracking/positions/batch`. O endpoint unitário permanece por
 * compatibilidade.
 */
export interface PositionBatchRequest {
  positions: PositionUpdateRequest[];
}

/** Resposta do envio em lote. */
export interface PositionBatchResponse {
  /** Quantidade de posições registradas. */
  accepted: number;
  positions: DriverPositionView[];
}

/** Posição de um motorista (última conhecida ou ponto do histórico). */
export interface DriverPositionView {
  driverId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speed: number | null;
  heading: number | null;
  /** Status efetivo já considerando inatividade (pode virar `offline`). */
  status: TrackingStatus;
}

/** Histórico de posições de um motorista (ordenado do mais recente ao mais antigo). */
export interface PositionHistoryResponse {
  driverId: string;
  points: DriverPositionView[];
}
