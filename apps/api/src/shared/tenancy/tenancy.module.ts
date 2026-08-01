import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { FeatureAccessService } from './feature-access.service';
import { TENANT_PLAN_READER } from './tenant-plan.port';
import { TenantPlanRepository } from './tenant-plan.repository';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';

/**
 * Registra globalmente o interceptor que estabelece o contexto de tenant e a
 * transação com `app.current_tenant` (RLS) para todo request autenticado.
 */
@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
    { provide: TENANT_PLAN_READER, useClass: TenantPlanRepository },
    FeatureAccessService,
  ],
  exports: [FeatureAccessService],
})
export class TenancyModule {}
