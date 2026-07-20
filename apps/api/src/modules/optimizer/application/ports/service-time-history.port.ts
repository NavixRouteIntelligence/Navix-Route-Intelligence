export interface ServiceTimeHistoryPoint {
  latitude: number;
  longitude: number;
}

/**
 * Porta anti-corrupção do Optimizer para o histórico de tempo de serviço da
 * Inteligência Coletiva (ADR-0065). O adaptador delega para a API pública do
 * Intelligence. Retorna `null` por ponto quando não há amostra suficiente — o
 * solver cai no default por tipo de destino / global.
 */
export interface ServiceTimeHistoryPort {
  typicalServiceMinutes(
    tenantId: string,
    points: ServiceTimeHistoryPoint[],
  ): Promise<(number | null)[]>;
}

export const SERVICE_TIME_HISTORY = Symbol('SERVICE_TIME_HISTORY');
