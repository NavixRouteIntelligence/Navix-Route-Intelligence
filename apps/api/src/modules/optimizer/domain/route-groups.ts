import type { DestinationType, RouteGroupView, RouteStopView } from '@navix/contracts';

/** Tipo usado quando a parada não foi classificada. */
const UNCLASSIFIED: DestinationType = 'other';

function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Agrega as paradas em **Grupos Inteligentes** por tipo de destino (ADR-0075).
 *
 * A rota NÃO é reordenada: a IA já definiu a sequência ótima, e o grupo é a
 * *leitura* dessa sequência por categoria — o motorista vê "4 comércios, depois
 * 6 casas" sem que isso mude a ordem de execução.
 *
 * Custos são atribuídos por parada: cada uma leva ao seu grupo a **perna de
 * chegada** (`legDistanceKm`) e o **avanço de ETA** desde a parada anterior.
 * Assim os grupos particionam exatamente o total da rota — a soma bate com
 * `metrics`, sem dupla contagem nem sobra.
 *
 * A ordem dos grupos é a da **primeira aparição** na rota, não a alfabética nem
 * a por volume: é o que o motorista encontra primeiro.
 *
 * Função pura sobre a visão de paradas — sem I/O, testável isoladamente.
 */
export function buildRouteGroups(stops: readonly RouteStopView[]): RouteGroupView[] {
  const byType = new Map<
    DestinationType,
    { firstSequence: number; sequences: number[]; distanceKm: number; timeMinutes: number }
  >();

  // As paradas podem chegar fora de ordem; a atribuição de tempo depende da
  // sequência real, então ordenamos uma cópia antes de percorrer.
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);

  let previousEta = 0;
  for (const stop of ordered) {
    const type = stop.destinationType ?? UNCLASSIFIED;
    // ETA é cumulativo; o avanço é o tempo atribuível a esta parada. Nunca
    // negativo, mesmo que um plano antigo traga ETA não-monotônico.
    const legMinutes = Math.max(0, stop.etaMinutes - previousEta);
    previousEta = stop.etaMinutes;

    const group = byType.get(type);
    if (group) {
      group.sequences.push(stop.sequence);
      group.distanceKm += stop.legDistanceKm;
      group.timeMinutes += legMinutes;
    } else {
      byType.set(type, {
        firstSequence: stop.sequence,
        sequences: [stop.sequence],
        distanceKm: stop.legDistanceKm,
        timeMinutes: legMinutes,
      });
    }
  }

  return [...byType.entries()]
    .sort((a, b) => a[1].firstSequence - b[1].firstSequence)
    .map(([type, g], index) => ({
      type,
      order: index + 1,
      stops: g.sequences.length,
      sequences: g.sequences,
      distanceKm: round(g.distanceKm),
      timeMinutes: round(g.timeMinutes),
    }));
}
