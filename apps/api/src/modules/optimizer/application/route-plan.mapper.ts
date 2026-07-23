import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import { buildRouteGroups } from '../domain/route-groups';
import type { RoutePlan } from '../domain/route-plan';

export function toRoutePlanView(plan: RoutePlan): RoutePlanView {
  const s = plan.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    strategy: s.strategy,
    status: s.status,
    params: s.params,
    stops: s.stops,
    // Derivado na leitura, não persistido: planos antigos também ganham grupos.
    groups: buildRouteGroups(s.stops),
    metrics: s.metrics,
    baseline: s.baseline,
    savings: s.savings,
    score: s.score,
    explanation: s.explanation,
    ...(s.capacity ? { capacity: s.capacity } : {}),
    ...(s.routes ? { routes: s.routes } : {}),
    ...(s.unassignedStops ? { unassignedStops: s.unassignedStops } : {}),
    createdAt: s.createdAt.toISOString(),
  };
}
