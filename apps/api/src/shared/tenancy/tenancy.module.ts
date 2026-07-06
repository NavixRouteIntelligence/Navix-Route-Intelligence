import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';

/**
 * Registra globalmente o interceptor que estabelece o contexto de tenant e a
 * transação com `app.current_tenant` (RLS) para todo request autenticado.
 */
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor }],
})
export class TenancyModule {}
