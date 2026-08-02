/** Recursos cujo acesso depende do plano comercial do tenant (ADR-0093). */
export const PLAN_FEATURES = [
  'dynamic_reoptimization',
  'predictive_alerts',
  'advanced_cx',
  'white_label',
  'enterprise_sso',
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];

/**
 * Matriz única de direitos por plano.
 *
 * `pro` é mantido como alias legado do seed/demo. Planos gratuitos, básicos,
 * autônomos ou desconhecidos não aparecem: a ausência nega por padrão.
 */
const OPERATIONAL_PREMIUM: readonly PlanFeature[] = [
  'dynamic_reoptimization',
  'predictive_alerts',
  'advanced_cx',
];

const ENTITLEMENTS: Readonly<Record<string, ReadonlySet<PlanFeature>>> = {
  fleet: new Set(OPERATIONAL_PREMIUM),
  enterprise: new Set(PLAN_FEATURES),
  pro: new Set(OPERATIONAL_PREMIUM),
};

export function planAllowsFeature(plan: string | null, feature: PlanFeature): boolean {
  if (!plan) return false;
  return ENTITLEMENTS[plan.trim().toLowerCase()]?.has(feature) ?? false;
}
