import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Rate limiting global (ver docs/security.md §7). Limite padrão amplo aplicado
 * a toda a API; endpoints sensíveis (login/refresh) recebem limites estritos via
 * @Throttle no controller. Armazenamento em memória no MVP — em produção,
 * recomenda-se o storage Redis para funcionar com múltiplas instâncias.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 min
        limit: 120,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottlingModule {}
