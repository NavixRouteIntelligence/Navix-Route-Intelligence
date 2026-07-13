import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Registra o `IdempotencyInterceptor` globalmente. Deve ser importado **depois**
 * do `TenancyModule` no AppModule para rodar **dentro** da transação de tenant
 * (onde a RLS está ativa) — assim a gravação da chave é atômica com a operação.
 */
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class IdempotencyModule {}
