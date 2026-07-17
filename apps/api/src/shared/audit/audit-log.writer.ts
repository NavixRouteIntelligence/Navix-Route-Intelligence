import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { newId } from '../kernel/id';
import type { AuditEntry, AuditLogPort } from './audit-log.port';
import { AuditLogOrmEntity } from './audit-log.orm-entity';

/**
 * Implementação TypeORM da auditoria. Falhas de auditoria não devem derrubar a
 * operação de negócio: registramos o erro, mas não relançamos.
 */
@Injectable()
export class AuditLogWriter implements AuditLogPort {
  private readonly logger = new Logger(AuditLogWriter.name);

  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly repo: Repository<AuditLogOrmEntity>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      const row = new AuditLogOrmEntity();
      row.id = newId();
      row.tenantId = entry.tenantId;
      row.actorId = entry.actorId;
      row.action = entry.action;
      row.resource = entry.resource ?? null;
      row.metadata = entry.metadata ?? {};
      row.createdAt = new Date();
      // `insert().updateEntity(false)` — sem `RETURNING`. `save()` faria
      // INSERT ... RETURNING para recarregar as colunas com `default`
      // (metadata, created_at); o RETURNING dispara a política de SELECT da RLS
      // (ADR-0054), que falha porque a auditoria grava **sem** contexto de
      // tenant — e o catch abaixo esconderia a falha. Como o writer já preenche
      // todos os campos, nada precisa voltar do banco (ADR-0054/fix). O cast
      // contorna o atrito do tipo de `jsonb` (metadata) no `.values()`.
      await this.repo
        .createQueryBuilder()
        .insert()
        .values(row as QueryDeepPartialEntity<AuditLogOrmEntity>)
        .updateEntity(false)
        .execute();
    } catch (error) {
      this.logger.error(
        `Falha ao gravar auditoria (${entry.action})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
