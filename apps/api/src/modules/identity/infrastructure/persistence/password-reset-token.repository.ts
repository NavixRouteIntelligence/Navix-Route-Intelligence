import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  PasswordResetTokenRepositoryPort,
  StoredResetToken,
} from '../../domain/ports/password-reset-token-repository.port';
import { PasswordResetTokenOrmEntity } from './password-reset-token.orm-entity';

@Injectable()
export class PasswordResetTokenRepository implements PasswordResetTokenRepositoryPort {
  constructor(
    @InjectRepository(PasswordResetTokenOrmEntity)
    private readonly repo: Repository<PasswordResetTokenOrmEntity>,
  ) {}

  async save(token: StoredResetToken): Promise<void> {
    await this.repo.save(this.repo.create(token));
  }

  async findByHash(tokenHash: string): Promise<StoredResetToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update({ id }, { usedAt: new Date() });
  }
}
