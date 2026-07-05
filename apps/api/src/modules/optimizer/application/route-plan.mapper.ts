import type { RoutePlan as RoutePlanView } from '@navix/contracts';

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
    metrics: s.metrics,
    baseline: s.baseline,
    savings: s.savings,
    score: s.score,
    explanation: s.explanation,
    createdAt: s.createdAt.toISOString(),
  };
}
