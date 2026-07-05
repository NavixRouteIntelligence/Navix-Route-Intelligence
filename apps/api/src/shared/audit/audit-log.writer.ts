import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
      await this.repo.save(row);
    } catch (error) {
      this.logger.error(
        `Falha ao gravar auditoria (${entry.action})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
