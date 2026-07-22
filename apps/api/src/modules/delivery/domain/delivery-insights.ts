import type { HourStat, RegionStat } from '@navix/contracts';

/** Uma entrega concluída, reduzida ao que os insights usam. */
export interface InsightInput {
  city: string;
  /** Hora do dia da conclusão (0–23, UTC). */
  hour: number;
}

export interface AggregatedInsights {
  totalDelivered: number;
  topRegions: RegionStat[];
  byHour: HourStat[];
  bestRegion: string | null;
  bestHour: number | null;
}

const TOP_REGIONS = 5;

/**
 * Agrega entregas concluídas por **cidade** e por **hora do dia** (FASE 3, F2).
 * Pura e determinística. `byHour` traz as 24 horas (inclui zeros) para gráficos;
 * `topRegions` as cidades de maior volume. Empates resolvidos por ordem alfabética.
 */
export function aggregateDeliveryInsights(items: InsightInput[]): AggregatedInsights {
  const byCity = new Map<string, number>();
  const hours = new Array<number>(24).fill(0);

  for (const it of items) {
    const city = it.city.trim();
    if (city.length > 0) byCity.set(city, (byCity.get(city) ?? 0) + 1);
    if (it.hour >= 0 && it.hour < 24) hours[it.hour] += 1;
  }

  const topRegions: RegionStat[] = [...byCity.entries()]
    .map(([city, deliveries]) => ({ city, deliveries }))
    .sort((a, b) => b.deliveries - a.deliveries || a.city.localeCompare(b.city))
    .slice(0, TOP_REGIONS);

  const byHour: HourStat[] = hours.map((deliveries, hour) => ({ hour, deliveries }));

  let bestHour: number | null = null;
  let bestHourCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hours[h] > bestHourCount) {
      bestHourCount = hours[h];
      bestHour = h;
    }
  }

  return {
    totalDelivered: items.length,
    topRegions,
    byHour,
    bestRegion: topRegions.length > 0 ? topRegions[0].city : null,
    bestHour,
  };
}
