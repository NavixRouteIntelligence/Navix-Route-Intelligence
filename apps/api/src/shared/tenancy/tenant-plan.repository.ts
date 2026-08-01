import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { TenantPlanReaderPort } from './tenant-plan.port';

/** O plano muda raramente; evita uma consulta em cada evento de GPS. */
const CACHE_TTL_MS = 60_000;

/**
 * Lê o registry de tenants. A tabela `tenants` não usa RLS porque ela própria
 * define o tenant; por isso a consulta é sempre por id explícito e parametrizado.
 */
@Injectable()
export class TenantPlanRepository implements TenantPlanReaderPort {
  private readonly logger = new Logger(TenantPlanRepository.name);
  private readonly cache = new Map<string, { plan: string | null; at: number }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findPlan(tenantId: string): Promise<string | null> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.plan;

    try {
      const rows = (await this.dataSource.query('SELECT plan FROM tenants WHERE id = $1', [
        tenantId,
      ])) as { plan?: string | null }[];
      const plan = rows[0]?.plan?.trim().toLowerCase() ?? null;
      this.cache.set(tenantId, { plan, at: Date.now() });
      return plan;
    } catch (err) {
      // Não cacheia falha de infraestrutura: a próxima chamada pode recuperar.
      this.logger.warn(
        `Não foi possível ler o plano do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
