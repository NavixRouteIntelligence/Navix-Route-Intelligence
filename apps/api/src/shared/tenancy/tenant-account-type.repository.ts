import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AccountType } from '@navix/contracts';
import { DataSource } from 'typeorm';

import { DEFAULT_ACCOUNT_TYPE, type TenantAccountTypeReaderPort } from './tenant-account-type.port';

/** O tipo de conta não muda depois do registo; evita uma consulta por leitura. */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * Lê `tenants.account_type`. Mesma forma do `TenantTimeZoneRepository`: a
 * tabela `tenants` não usa RLS porque ela própria define o tenant, então a
 * consulta é sempre por id explícito e parametrizado.
 *
 * Falha de infraestrutura devolve `company` — o valor que **restringe**. Ver a
 * nota em [DEFAULT_ACCOUNT_TYPE].
 */
@Injectable()
export class TenantAccountTypeRepository implements TenantAccountTypeReaderPort {
  private readonly logger = new Logger(TenantAccountTypeRepository.name);
  private readonly cache = new Map<string, { tipo: AccountType; at: number }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAccountType(tenantId: string): Promise<AccountType> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.tipo;

    try {
      const rows = (await this.dataSource.query('SELECT account_type FROM tenants WHERE id = $1', [
        tenantId,
      ])) as { account_type?: string | null }[];
      const tipo = rows[0]?.account_type === 'driver' ? 'driver' : DEFAULT_ACCOUNT_TYPE;
      this.cache.set(tenantId, { tipo, at: Date.now() });
      return tipo;
    } catch (err) {
      // Não cacheia falha: a próxima chamada pode recuperar.
      this.logger.warn(
        `Não foi possível ler o tipo de conta do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return DEFAULT_ACCOUNT_TYPE;
    }
  }
}
