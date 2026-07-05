import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type {
  RefreshTokenRepositoryPort,
  StoredRefreshToken,
} from '../../domain/ports/refresh-token-repository.port';
import { RefreshTokenOrmEntity } from './refresh-token.orm-entity';

/** Implementação TypeORM da port de refresh tokens. */
@Injectable()
export class RefreshTokenRepository implements RefreshTokenRepositoryPort {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repo: Repository<RefreshTokenOrmEntity>,
  ) {}

  async save(token: StoredRefreshToken): Promise<void> {
    await this.repo.save(this.repo.create(token));
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const row = await this.repo.findOne({ where: { tokenHash } });
    return row ?? null;
  }

  async revoke(id: string): Promise<void> {
    await this.repo.update({ id }, { revokedAt: new Date() });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
