import { ForbiddenError } from '../kernel/domain-error';

import { FeatureAccessService } from './feature-access.service';
import { PLAN_FEATURES } from './plan-feature';
import type { TenantPlanReaderPort } from './tenant-plan.port';

function serviceFor(plan: string | null): FeatureAccessService {
  const plans: TenantPlanReaderPort = { findPlan: jest.fn().mockResolvedValue(plan) };
  return new FeatureAccessService(plans);
}

describe('FeatureAccessService', () => {
  it('enterprise acessa recursos operacionais e corporativos', async () => {
    const service = serviceFor('enterprise');

    await expect(
      Promise.all(PLAN_FEATURES.map((feature) => service.isEnabled('tenant-1', feature))),
    ).resolves.toEqual([true, true, true, true, true]);
  });

  it.each(['fleet', 'pro'])('%s acessa somente os recursos operacionais', async (plan) => {
    const service = serviceFor(plan);

    await expect(
      Promise.all(PLAN_FEATURES.map((feature) => service.isEnabled('tenant-1', feature))),
    ).resolves.toEqual([true, true, true, false, false]);
  });

  it.each(['free', 'basic', 'autonomous', 'desconhecido', null])(
    '%s não acessa recursos premium',
    async (plan) => {
      const service = serviceFor(plan);

      await expect(
        Promise.all(PLAN_FEATURES.map((feature) => service.isEnabled('tenant-1', feature))),
      ).resolves.toEqual([false, false, false, false, false]);
    },
  );

  it('require devolve erro de domínio 403 quando o plano não permite', async () => {
    await expect(serviceFor('free').require('tenant-1', 'advanced_cx')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
