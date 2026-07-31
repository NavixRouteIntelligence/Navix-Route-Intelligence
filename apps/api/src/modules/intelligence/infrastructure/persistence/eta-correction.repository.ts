import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { EtaCorrection } from '../../domain/eta-correction';
import type { EtaCorrectionRepositoryPort } from '../../domain/ports/eta-correction-repository.port';
import { EtaCorrectionOrmEntity } from './eta-correction.orm-entity';

@Injectable()
export class EtaCorrectionRepository implements EtaCorrectionRepositoryPort {
  constructor(
    @InjectRepository(EtaCorrectionOrmEntity)
    private readonly base: Repository<EtaCorrectionOrmEntity>,
  ) {}

  private get repo(): Repository<EtaCorrectionOrmEntity> {
    return scopedRepository(this.base);
  }

  async findAll(tenantId: string): Promise<EtaCorrection[]> {
    const rows = await this.repo.find({ where: { tenantId } });
    return rows.map((r) => ({
      bucket: r.bucket,
      samples: r.samples,
      correctionMinutes: r.correctionMinutes,
    }));
  }

  async replace(
    tenantId: string,
    corrections: EtaCorrection[],
    trainedAt: Date,
  ): Promise<void> {
    const repo = this.repo;
    await repo.delete({ tenantId });
    if (corrections.length === 0) return;
    await repo.insert(
      corrections.map((c) => ({
        tenantId,
        bucket: c.bucket,
        samples: c.samples,
        correctionMinutes: c.correctionMinutes,
        trainedAt,
      })),
    );
  }
}
