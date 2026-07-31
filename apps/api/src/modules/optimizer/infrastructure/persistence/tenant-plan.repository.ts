import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PREMIUM_PLANS, type TenantPlanPort } from '../../application/ports/tenant-plan.port';

/** Evita uma consulta por posição recebida; o plano muda raramente. */
const CACHE_TTL_MS = 60_000;

/**
 * Lê `tenants.plan` (ADR-0083).
 *
 * A tabela `tenants` é o **registry** de tenants e, por isso, não tem RLS — não
 * poderia ter, já que é ela que define o tenant. A consulta é por id explícito,
 * então continua impossível ler o plano de outro tenant sem conhecer o id.
 */
@Injectable()
export class TenantPlanRepository implements TenantPlanPort {
  private readonly logger = new Logger('TenantPlan');
  private readonly cache = new Map<string, { allowed: boolean; at: number }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  allowsPredictiveAlerts(tenantId: string): Promise<boolean> {
    // Mesmo direito, mesmo cache: os dois recursos premium andam juntos nos
    // planos de hoje (ver `PREMIUM_PLANS`).
    return this.allowsDynamicReoptimization(tenantId);
  }

  async allowsDynamicReoptimization(tenantId: string): Promise<boolean> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.allowed;

    try {
      const rows = (await this.dataSource.query('SELECT plan FROM tenants WHERE id = $1', [
        tenantId,
      ])) as { plan?: string }[];

      const plan = rows[0]?.plan;
      const allowed = plan !== undefined && PREMIUM_PLANS.includes(plan);
      this.cache.set(tenantId, { allowed, at: Date.now() });
      return allowed;
    } catch (err) {
      // Nega em caso de falha (ver o contrato da port): não liberar recurso pago
      // por causa de um erro de banco. Não cacheia, para reavaliar já na próxima.
      this.logger.warn(
        `Não foi possível ler o plano do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
