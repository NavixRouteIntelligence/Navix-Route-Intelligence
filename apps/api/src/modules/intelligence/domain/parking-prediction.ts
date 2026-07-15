import type { ParkingPredictionView } from '@navix/contracts';

/**
 * Previsão de estacionamento (ADR-0029). Heurística: usa o **congestionamento
 * previsto** (fator de trânsito no horário de chegada) como proxy da dificuldade
 * de estacionar — mais trânsito ⇒ mais disputa por vaga. Pura e determinística;
 * evolui para um modelo de **disponibilidade de vaga** (histórico de POD/dwell,
 * dados de zona) pela mesma port, sem tocar consumidores.
 */
export function predictParkingFromTraffic(trafficFactor: number): ParkingPredictionView {
  if (trafficFactor >= 1.35) return { difficulty: 'hard', confidence: 0.6, walkMinutes: 5 };
  if (trafficFactor >= 1.1) return { difficulty: 'moderate', confidence: 0.65, walkMinutes: 3 };
  return { difficulty: 'easy', confidence: 0.7, walkMinutes: 2 };
}
