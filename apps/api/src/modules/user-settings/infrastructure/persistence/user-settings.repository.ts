import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import { sanitizeSettings, type UserSettingsRecord } from '../../domain/user-settings';
import type { UserSettingsRepositoryPort } from '../../domain/ports/user-settings-repository.port';
import { UserSettingsOrmEntity } from './user-settings.orm-entity';

@Injectable()
export class UserSettingsRepository implements UserSettingsRepositoryPort {
  constructor(
    @InjectRepository(UserSettingsOrmEntity)
    private readonly base: Repository<UserSettingsOrmEntity>,
  ) {}

  private get repo(): Repository<UserSettingsOrmEntity> {
    return scopedRepository(this.base);
  }

  async find(tenantId: string, userId: string): Promise<UserSettingsRecord | null> {
    const row = await this.repo.findOne({ where: { tenantId, userId } });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      userId: row.userId,
      // Blinda contra dados legados/corrompidos no JSONB.
      settings: sanitizeSettings(row.data),
      updatedAt: row.updatedAt,
    };
  }

  async save(record: UserSettingsRecord): Promise<void> {
    const row = new UserSettingsOrmEntity();
    row.userId = record.userId;
    row.tenantId = record.tenantId;
    row.data = record.settings;
    row.updatedAt = record.updatedAt;
    await this.repo.save(row);
  }
}
