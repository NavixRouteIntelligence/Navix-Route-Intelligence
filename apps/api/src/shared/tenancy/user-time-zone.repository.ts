import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../database/transaction-context';
import type { UserTimeZoneReaderPort } from './user-time-zone.port';

/**
 * Lê `user_profiles.time_zone` sob a RLS do tenant.
 *
 * Falha de infraestrutura devolve `null` — que aqui significa «não escolheu» e
 * faz a cadeia continuar para o tenant. Propagar o erro derrubaria o resumo por
 * causa de uma preferência.
 */
@Injectable()
export class UserTimeZoneRepository implements UserTimeZoneReaderPort {
  private readonly logger = new Logger(UserTimeZoneRepository.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findTimeZone(tenantId: string, userId: string): Promise<string | null> {
    const manager = transactionContext.getStore() ?? this.dataSource.manager;
    try {
      const rows = (await manager.query(
        `SELECT time_zone FROM user_profiles WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, userId],
      )) as { time_zone?: string | null }[];
      return rows[0]?.time_zone?.trim() || null;
    } catch (err) {
      this.logger.warn(
        `Não foi possível ler o fuso do utilizador ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
