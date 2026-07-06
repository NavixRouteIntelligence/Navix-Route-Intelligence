import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@navix/contracts';
import { firstValueFrom, from, Observable } from 'rxjs';
import { DataSource } from 'typeorm';

import { transactionContext } from '../database/transaction-context';
import { TenantContextStore } from './tenant-context';

/**
 * Para cada request AUTENTICADO, abre uma transação, define
 * `app.current_tenant` (SET LOCAL via set_config) e executa o handler dentro
 * dela. Assim a RLS do PostgreSQL isola os dados por tenant no nível do banco —
 * mesmo que o código de aplicação tenha um bug (ver docs/security.md §3).
 *
 * Requests públicos (sem `req.user`) passam direto, sem transação de tenant.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return next.handle();
    }

    const tenantCtx = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles,
    };

    return from(
      this.dataSource.transaction(async (manager) => {
        // is_local = true → vale apenas para esta transação.
        await manager.query("SELECT set_config('app.current_tenant', $1, true)", [
          user.tenantId,
        ]);
        return transactionContext.run(manager, () =>
          TenantContextStore.run(tenantCtx, () => firstValueFrom(next.handle())),
        );
      }),
    );
  }
}
