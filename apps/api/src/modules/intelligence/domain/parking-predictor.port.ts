import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';

/**
 * Previsão de estacionamento no destino (ADR-0029). Port desacoplada: hoje uma
 * heurística por congestionamento, opcionalmente enriquecida pela inteligência
 * coletiva do tenant (ADR-0031/integração B); amanhã um modelo de
 * disponibilidade de vaga — sem tocar o caso de uso. Assíncrona para permitir
 * adaptadores que consultam o histórico da frota (escopo por `tenantId`).
 */
export interface ParkingPredictorPort {
  predict(input: { tenantId: string; point: LatLng; arrivalAt: Date }): Promise<ParkingPredictionView>;
}

export const PARKING_PREDICTOR = Symbol('PARKING_PREDICTOR');
