import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { UserProfileRecord } from '../../domain/user-profile';
import type { UserProfileRepositoryPort } from '../../domain/ports/user-profile-repository.port';
import { UserProfileOrmEntity } from './user-profile.orm-entity';

@Injectable()
export class UserProfileRepository implements UserProfileRepositoryPort {
  constructor(
    @InjectRepository(UserProfileOrmEntity)
    private readonly base: Repository<UserProfileOrmEntity>,
  ) {}

  private get repo(): Repository<UserProfileOrmEntity> {
    return scopedRepository(this.base);
  }

  async find(tenantId: string, userId: string): Promise<UserProfileRecord | null> {
    const row = await this.repo.findOne({ where: { tenantId, userId } });
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      userId: row.userId,
      profile: {
        displayName: row.displayName,
        phone: row.phone,
        jobTitle: row.jobTitle,
        timeZone: row.timeZone,
        avatarUrl: row.avatar,
      },
      updatedAt: row.updatedAt,
    };
  }

  async save(record: UserProfileRecord): Promise<void> {
    const row = new UserProfileOrmEntity();
    row.userId = record.userId;
    row.tenantId = record.tenantId;
    row.displayName = record.profile.displayName;
    row.phone = record.profile.phone;
    row.jobTitle = record.profile.jobTitle;
    row.timeZone = record.profile.timeZone;
    row.avatar = record.profile.avatarUrl;
    row.updatedAt = record.updatedAt;
    await this.repo.save(row);
  }
}
