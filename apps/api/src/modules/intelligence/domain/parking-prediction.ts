import type { CollectiveParkingInsight, ParkingDifficulty, ParkingPredictionView } from '@navix/contracts';

/** Caminhada estimada (min) até a porta por dificuldade. */
const WALK_MINUTES: Record<ParkingDifficulty, number> = { easy: 2, moderate: 3, hard: 5 };
const DIFFICULTY_RANK: Record<ParkingDifficulty, number> = { easy: 0, moderate: 1, hard: 2 };
const BY_RANK: ParkingDifficulty[] = ['easy', 'moderate', 'hard'];

/**
 * Previsão de estacionamento (ADR-0029). Heurística: usa o **congestionamento
 * previsto** (fator de trânsito no horário de chegada) como proxy da dificuldade
 * de estacionar — mais trânsito ⇒ mais disputa por vaga. Pura e determinística;
 * evolui para um modelo de **disponibilidade de vaga** (histórico de POD/dwell,
 * dados de zona) pela mesma port, sem tocar consumidores.
 */
export function predictParkingFromTraffic(trafficFactor: number): ParkingPredictionView {
  if (trafficFactor >= 1.35) return { difficulty: 'hard', confidence: 0.6, walkMinutes: WALK_MINUTES.hard };
  if (trafficFactor >= 1.1) return { difficulty: 'moderate', confidence: 0.65, walkMinutes: WALK_MINUTES.moderate };
  return { difficulty: 'easy', confidence: 0.7, walkMinutes: WALK_MINUTES.easy };
}

/**
 * Combina a previsão heurística (trânsito) com o que a **frota observou** no
 * local (inteligência coletiva, ADR-0031). A observação real puxa a dificuldade
 * na proporção da sua confiança e eleva a confiança final — o mundo real pesa
 * mais que o proxy. Pura e determinística (ADR-0033/integração B).
 */
export function blendParking(
  heuristic: ParkingPredictionView,
  community?: CollectiveParkingInsight,
): ParkingPredictionView {
  if (!community) return heuristic;
  const weight = community.confidence; // 0..1 — peso da observação da comunidade
  const blendedRank = Math.round(
    DIFFICULTY_RANK[heuristic.difficulty] * (1 - weight) + DIFFICULTY_RANK[community.difficulty] * weight,
  );
  const difficulty = BY_RANK[Math.max(0, Math.min(2, blendedRank))];
  const confidence =
    Math.round((Math.min(0.95, (heuristic.confidence + community.confidence) / 2 + 0.1)) * 100) / 100;
  return { difficulty, confidence, walkMinutes: WALK_MINUTES[difficulty] };
}
