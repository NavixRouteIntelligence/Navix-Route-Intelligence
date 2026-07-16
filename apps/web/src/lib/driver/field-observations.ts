import type { ParkingDifficulty, VoiceCommandView } from '@navix/contracts';

/** Teto de tempo de atendimento aceito pela API (min). */
export const MAX_DWELL_MINUTES = 600;

/**
 * Tempo de permanência (dwell) numa parada, em minutos, a partir dos instantes
 * de início e conclusão. Limitado a [0, MAX_DWELL_MINUTES] e arredondado a 1
 * casa — vira uma observação `service_time` da inteligência coletiva (ADR-0031).
 */
export function dwellMinutes(startMs: number, nowMs: number): number {
  const minutes = (nowMs - startMs) / 60000;
  return Math.max(0, Math.min(MAX_DWELL_MINUTES, Math.round(minutes * 10) / 10));
}

/**
 * Dificuldade de estacionamento relatada por voz. Usa o slot extraído da fala;
 * na ausência, assume `hard` (o motorista só reporta quando é ruim).
 */
export function reportedParkingDifficulty(view: VoiceCommandView): ParkingDifficulty {
  return view.slots.parkingDifficulty ?? 'hard';
}
