import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { RegisterRequest, RegisterResponse } from '@navix/contracts';
import { DataSource } from 'typeorm';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port';
import { PASSWORD_HASHER, type PasswordHasherPort } from './ports/password-hasher.port';
import { TOKEN_SERVICE, type TokenServicePort } from './ports/token-service.port';

/**
 * Criação de conta com escolha de perfil (Motorista Autônomo × Empresa).
 *
 * - **Empresa**: cria a organização e o usuário como `admin` → Dashboard admin.
 * - **Motorista Autônomo**: cria uma organização pessoal e o usuário como
 *   `driver` (motorista principal) → Dashboard do Motorista.
 *
 * Tenant + usuário são criados numa única transação. Como `users` roda com RLS
 * desabilitada (fluxos públicos pré-tenant) e `tenants` não tem RLS, não é
 * preciso contexto de tenant aqui. O `account_type` no tenant deixa a futura
 * migração Autônomo → Empresa possível sem perda de dados.
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: RegisterRequest): Promise<RegisterResponse> {
    const accountType = command.accountType;
    const name = command.name.trim();
    const email = command.email.trim().toLowerCase();

    if (!name) {
      throw new ValidationError('Nome é obrigatório.');
    }
    const organizationName =
      accountType === 'company'
        ? (command.organizationName ?? '').trim()
        : `Conta de ${name}`;
    if (accountType === 'company' && !organizationName) {
      throw new ValidationError('Nome da empresa é obrigatório.');
    }

    const roles = accountType === 'company' ? ['admin'] : ['driver'];
    const passwordHash = await this.hasher.hash(command.password);
    const tenantId = newId();
    const userId = newId();

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO tenants (id, name, account_type) VALUES ($1, $2, $3)`,
        [tenantId, organizationName, accountType],
      );
      await manager.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, status, roles)
           VALUES ($1, $2, $3, $4, 'active', $5)`,
        [userId, tenantId, email, passwordHash, roles],
      );
    });

    const access = await this.tokens.signAccessToken({ sub: userId, tenantId, roles });
    const refresh = this.tokens.issueRefreshToken(userId);
    await this.refreshTokens.save({
      id: newId(),
      userId,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
    });

    await this.audit.record({
      tenantId,
      actorId: userId,
      action: 'auth.registered',
      resource: `user:${userId}`,
      metadata: { accountType, organizationName },
    });

    return {
      user: { id: userId, tenantId, email, roles },
      tokens: {
        accessToken: access.token,
        expiresIn: access.expiresIn,
        refreshToken: refresh.token,
      },
      accountType,
    };
  }
}
