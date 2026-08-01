import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenError } from '../kernel/domain-error';

import { planAllowsFeature, type PlanFeature } from './plan-feature';
import { TENANT_PLAN_READER, type TenantPlanReaderPort } from './tenant-plan.port';

/**
 * Ponto único de decisão para feature flags por tenant/plano (ADR-0093).
 *
 * Casos de uso consultam este serviço; nenhum módulo interpreta strings de
 * plano por conta própria. Plano ausente, desconhecido ou falha de leitura
 * resulta em acesso negado (fail closed).
 */
@Injectable()
export class FeatureAccessService {
  constructor(
    @Inject(TENANT_PLAN_READER) private readonly plans: TenantPlanReaderPort,
  ) {}

  async isEnabled(tenantId: string, feature: PlanFeature): Promise<boolean> {
    return planAllowsFeature(await this.plans.findPlan(tenantId), feature);
  }

  async require(tenantId: string, feature: PlanFeature): Promise<void> {
    if (!(await this.isEnabled(tenantId, feature))) {
      throw new ForbiddenError('Recurso não disponível no plano atual.');
    }
  }
}
