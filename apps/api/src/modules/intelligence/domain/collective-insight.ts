import type {
  CollectiveInsightView,
  CollectiveParkingInsight,
  ObservationKind,
  ParkingDifficulty,
} from '@navix/contracts';

/**
 * Observação de campo persistida (ADR-0031). Uma linha por relato de motorista;
 * o `driverId` serve para dedupe/anti-abuso e **nunca** é exposto no insight.
 */
export interface CollectiveObservation {
  id: string;
  tenantId: string;
  driverId: string;
  cell: string;
  latitude: number;
  longitude: number;
  kind: ObservationKind;
  parkingDifficulty: ParkingDifficulty | null;
  serviceMinutes: number | null;
  accessTip: string | null;
  createdAt: Date;
}

/**
 * Amostra mínima por dimensão antes de expor um agregado — evita que o relato de
 * um único motorista seja identificável e dá robustez estatística.
 */
export const MIN_SAMPLE = 3;

const DIFFICULTY_RANK: Record<ParkingDifficulty, number> = { easy: 0, moderate: 1, hard: 2 };

/**
 * Célula de localização (~110 m no equador): arredonda lat/lng a 3 casas. Agrupa
 * observações próximas sem expor coordenadas exatas. Determinística e estável.
 */
export function locationCell(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function aggregateParking(difficulties: ParkingDifficulty[]): CollectiveParkingInsight | undefined {
  if (difficulties.length < MIN_SAMPLE) return undefined;
  const counts = new Map<ParkingDifficulty, number>();
  for (const d of difficulties) counts.set(d, (counts.get(d) ?? 0) + 1);

  // Moda; empate resolvido pela dificuldade mais severa (mais conservador).
  let best: ParkingDifficulty = 'easy';
  let bestCount = -1;
  for (const [difficulty, count] of counts) {
    if (count > bestCount || (count === bestCount && DIFFICULTY_RANK[difficulty] > DIFFICULTY_RANK[best])) {
      best = difficulty;
      bestCount = count;
    }
  }
  // Confiança: concordância ponderada pelo tamanho da amostra.
  const agreement = bestCount / difficulties.length;
  const volume = difficulties.length / (difficulties.length + MIN_SAMPLE);
  const confidence = Math.round(Math.min(0.95, agreement * volume + 0.3) * 100) / 100;
  return { difficulty: best, confidence };
}

function aggregateAccessTips(tips: string[]): string[] {
  const byNorm = new Map<string, { text: string; count: number }>();
  for (const raw of tips) {
    const text = raw.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    const existing = byNorm.get(key);
    if (existing) existing.count += 1;
    else byNorm.set(key, { text, count: 1 });
  }
  return [...byNorm.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => t.text);
}

/**
 * Agrega as observações de uma célula num insight coletivo (ADR-0031). Puro e
 * determinístico; um modelo de agregação (pesos por recência/reputação) pode
 * substituí-lo sem tocar consumidores.
 */
export function aggregateInsight(
  cell: string,
  observations: CollectiveObservation[],
): CollectiveInsightView {
  const parkingDifficulties = observations
    .filter((o) => o.kind === 'parking' && o.parkingDifficulty !== null)
    .map((o) => o.parkingDifficulty as ParkingDifficulty);

  const serviceMinutes = observations
    .filter((o) => o.kind === 'service_time' && o.serviceMinutes !== null)
    .map((o) => o.serviceMinutes as number);

  const accessTips = observations
    .filter((o) => o.kind === 'access' && o.accessTip !== null)
    .map((o) => o.accessTip as string);

  const parking = aggregateParking(parkingDifficulties);
  const typicalServiceMinutes =
    serviceMinutes.length >= MIN_SAMPLE
      ? Math.round(median(serviceMinutes) * 10) / 10
      : undefined;

  return {
    cell,
    sampleSize: observations.length,
    ...(parking ? { parking } : {}),
    ...(typicalServiceMinutes !== undefined ? { typicalServiceMinutes } : {}),
    accessTips: aggregateAccessTips(accessTips),
  };
}
