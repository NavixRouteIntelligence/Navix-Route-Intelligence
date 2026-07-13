import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { User } from '../../domain/user';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserOrmEntity } from './user.orm-entity';

/** Implementação TypeORM da port de repositório de usuários. */
@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findByEmailAndOrganization(
    email: string,
    organizationSlug: string,
  ): Promise<User | null> {
    // Resolve o tenant pelo slug (tabela `tenants` sem RLS, acessível pré-tenant),
    // depois busca o usuário por e-mail dentro desse tenant.
    const tenants = (await this.repo.query(
      `SELECT id FROM tenants WHERE LOWER(slug) = LOWER($1) LIMIT 1`,
      [organizationSlug],
    )) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id;
    if (!tenantId) return null;

    const row = await this.repo
      .createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash, updatedAt: new Date() });
  }

  private toDomain(row: UserOrmEntity): User {
    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
      roles: row.roles,
    };
  }
}
