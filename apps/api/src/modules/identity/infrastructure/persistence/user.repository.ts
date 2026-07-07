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

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { tenantId, email } });
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
