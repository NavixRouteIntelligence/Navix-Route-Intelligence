import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { ReoptimizationTriggerPort } from '../../application/auto-reoptimization.service';
import { ReoptimizeActiveUseCase } from '../../application/reoptimize-active.use-case';

/**
 * Executa a reotimização fora de uma requisição, estabelecendo uma **transação
 * de tenant** própria (`app.current_tenant` para a RLS) — mesmo padrão da
 * `InProcessOptimizationJobQueue`. O ator é `system` (gatilho automático).
 */
@Injectable()
export class TenantScopedReoptimizationTrigger implements ReoptimizationTriggerPort {
  private readonly logger = new Logger('AutoReoptimization');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reoptimize: ReoptimizeActiveUseCase,
  ) {}

  async run(tenantId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      const accepted = await transactionContext.run(manager, () =>
        this.reoptimize.execute({ tenantId, actorId: 'system' }),
      );
      if (accepted) {
        this.logger.log(`Reotimização do tenant ${tenantId} enfileirada (job ${accepted.jobId}).`);
      }
    });
  }
}
