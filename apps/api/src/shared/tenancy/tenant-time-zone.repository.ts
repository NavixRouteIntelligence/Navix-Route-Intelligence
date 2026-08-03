import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DEFAULT_TIME_ZONE, type TenantTimeZoneReaderPort } from './tenant-time-zone.port';

/** O fuso muda praticamente nunca; evita uma consulta por rota consultada. */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * Lê `tenants.time_zone`. Mesma forma do `TenantPlanRepository`: a tabela
 * `tenants` não usa RLS porque ela própria define o tenant, então a consulta é
 * sempre por id explícito e parametrizado.
 *
 * Falha de infraestrutura devolve `UTC` em vez de propagar: um fuso ausente
 * degrada o dia operacional, mas um erro aqui derrubaria a tela da rota inteira.
 */
@Injectable()
export class TenantTimeZoneRepository implements TenantTimeZoneReaderPort {
  private readonly logger = new Logger(TenantTimeZoneRepository.name);
  private readonly cache = new Map<string, { zone: string; at: number }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findTimeZone(tenantId: string): Promise<string> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.zone;

    try {
      const rows = (await this.dataSource.query('SELECT time_zone FROM tenants WHERE id = $1', [
        tenantId,
      ])) as { time_zone?: string | null }[];
      const zone = rows[0]?.time_zone?.trim() || DEFAULT_TIME_ZONE;
      this.cache.set(tenantId, { zone, at: Date.now() });
      return zone;
    } catch (err) {
      // Não cacheia falha: a próxima chamada pode recuperar.
      this.logger.warn(
        `Não foi possível ler o fuso do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return DEFAULT_TIME_ZONE;
    }
  }
}
