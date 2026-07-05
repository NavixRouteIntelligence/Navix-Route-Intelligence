import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AUDIT_LOG } from './audit-log.port';
import { AuditLogOrmEntity } from './audit-log.orm-entity';
import { AuditLogWriter } from './audit-log.writer';

/**
 * Auditoria disponível globalmente: qualquer módulo injeta AUDIT_LOG para
 * registrar eventos sensíveis sem depender da infraestrutura de auditoria.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogOrmEntity])],
  providers: [{ provide: AUDIT_LOG, useClass: AuditLogWriter }],
  exports: [AUDIT_LOG],
})
export class AuditModule {}
