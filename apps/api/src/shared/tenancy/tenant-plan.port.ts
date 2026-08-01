/** Leitura mínima do plano comercial, isolada da regra de direitos. */
export interface TenantPlanReaderPort {
  findPlan(tenantId: string): Promise<string | null>;
}

export const TENANT_PLAN_READER = Symbol('TENANT_PLAN_READER');
