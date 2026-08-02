import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { scopedRepository } from '../../../shared/database/transaction-context';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { PUBLIC_API_SCOPES, type ApiKeyPrincipal, type PublicApiScope } from '../domain/public-api';
import { ApiKeyOrmEntity } from '../infrastructure/persistence/api-key.orm-entity';

export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: PublicApiScope[];
  quotaPerMinute: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKeyOrmEntity) private readonly repo: Repository<ApiKeyOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(input: {
    tenantId: string;
    name: string;
    scopes: PublicApiScope[];
    quotaPerMinute: number;
    expiresAt?: string;
  }): Promise<ApiKeyView & { apiKey: string }> {
    if (input.scopes.length === 0) throw new ValidationError('Selecione pelo menos um escopo.');
    if (!input.scopes.every((scope) => PUBLIC_API_SCOPES.includes(scope))) {
      throw new ValidationError('A chave contém um escopo inválido.');
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new ValidationError('A expiração precisa estar no futuro.');
    }

    const secret = `nvx_live_${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    const row = this.repo.create({
      id: newId(),
      tenantId: input.tenantId,
      name: input.name,
      keyPrefix: secret.slice(0, 20),
      secretHash: this.hash(secret),
      scopes: [...new Set(input.scopes)],
      quotaPerMinute: input.quotaPerMinute,
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    });
    try {
      await scopedRepository(this.repo).insert(row);
    } catch {
      throw new ConflictError('Não foi possível gerar uma chave única. Tente novamente.');
    }
    return { ...this.toView(row), apiKey: secret };
  }

  async list(tenantId: string): Promise<ApiKeyView[]> {
    const rows = await scopedRepository(this.repo).find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async revoke(tenantId: string, id: string): Promise<void> {
    const result = await scopedRepository(this.repo).update(
      { id, tenantId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) throw new NotFoundError('Chave de API não encontrada ou já revogada.');
  }

  async authenticate(secret: string): Promise<ApiKeyPrincipal | null> {
    const now = new Date();
    const row = await this.repo.findOne({
      where: { secretHash: this.hash(secret), revokedAt: IsNull() },
    });
    if (!row || (row.expiresAt && row.expiresAt <= now)) return null;
    // O lookup acontece antes de o tenant ser conhecido. A política de UPDATE
    // exige contexto, então o toque usa uma transação curta já isolada.
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [row.tenantId]);
      await manager.getRepository(ApiKeyOrmEntity).update({ id: row.id }, { lastUsedAt: now });
    });
    return {
      keyId: row.id,
      tenantId: row.tenantId,
      scopes: row.scopes as PublicApiScope[],
      quotaPerMinute: row.quotaPerMinute,
    };
  }

  private hash(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }

  private toView(row: ApiKeyOrmEntity): ApiKeyView {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes as PublicApiScope[],
      quotaPerMinute: row.quotaPerMinute,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
