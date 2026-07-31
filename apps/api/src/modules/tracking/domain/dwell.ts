import { haversineKm, type LatLng } from '../../../shared/kernel/geo';
import type { DriverPosition } from './driver-position';

/**
 * Raio que conta como "na parada" (~110 m) — a mesma célula da inteligência
 * coletiva (ADR-0031), para que o tempo medido e a célula onde ele é agregado
 * falem da mesma vizinhança.
 */
export const STOP_RADIUS_KM = 0.11;

/**
 * Quanto tempo antes da conclusão vale olhar. Vinte minutos cobre um
 * atendimento longo sem varrer o dia inteiro do motorista à toa.
 */
export const DWELL_WINDOW_MINUTES = 20;

/**
 * Tempo de atendimento **medido** na parada (ADR-0088).
 *
 * Pega a última sequência contígua de posições dentro do raio, terminando na
 * conclusão, e devolve sua duração. É a permanência: o deslocamento até ali
 * fica de fora por construção, porque a primeira posição fora do raio encerra a
 * sequência — que é exatamente o que o dwell relatado pelo cliente errava.
 *
 * Devolve `null` quando não dá para afirmar nada: sem posições no raio (GPS
 * desligado, motorista sem app) ou com uma só (não há intervalo a medir).
 * Nulo é melhor que zero — zero entraria na mediana como um atendimento
 * instantâneo que nunca houve.
 *
 * `positions` deve vir ordenada por `recordedAt` **crescente**.
 */
export function dwellMinutesAtStop(
  positions: DriverPosition[],
  stop: LatLng,
  radiusKm = STOP_RADIUS_KM,
): number | null {
  const dentro = (p: DriverPosition): boolean =>
    haversineKm({ latitude: p.latitude, longitude: p.longitude }, stop) <= radiusKm;

  // Varre de trás para frente: interessa a permanência que termina na conclusão,
  // não uma passagem anterior pela mesma rua.
  let inicio = -1;
  for (let i = positions.length - 1; i >= 0; i--) {
    if (!dentro(positions[i])) break;
    inicio = i;
  }

  if (inicio === -1) return null;
  const ultima = positions[positions.length - 1];
  if (inicio === positions.length - 1) return null;

  const minutos =
    (ultima.recordedAt.getTime() - positions[inicio].recordedAt.getTime()) / 60_000;
  return Math.round(minutos * 10) / 10;
}
