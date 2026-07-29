import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { EtaObservation } from '../../domain/eta-observation';
import type { EtaObservationRepositoryPort } from '../../domain/ports/eta-observation-repository.port';
import { EtaObservationOrmEntity } from './eta-observation.orm-entity';

@Injectable()
export class EtaObservationRepository implements EtaObservationRepositoryPort {
  constructor(
    @InjectRepository(EtaObservationOrmEntity)
    private readonly base: Repository<EtaObservationOrmEntity>,
  ) {}

  private get repo(): Repository<EtaObservationOrmEntity> {
    return scopedRepository(this.base);
  }

  async record(observation: EtaObservation): Promise<boolean> {
    // `DO NOTHING` no índice único (tenant, delivery): a conclusão da entrega é
    // um fato único, e o listener pode reprocessar o mesmo evento. Deixar o
    // banco resolver a corrida é mais barato — e mais correto sob concorrência —
    // do que um SELECT prévio.
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(EtaObservationOrmEntity)
      .values(observation)
      .orIgnore()
      .execute();
    return (result.identifiers[0] ?? null) !== null;
  }

  async recentErrors(
    tenantId: string,
    since: Date,
    limit: number,
  ): Promise<(number | null)[]> {
    const rows = await this.repo.find({
      where: { tenantId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: limit,
      select: ['errorMinutes'],
    });
    return rows.map((r) => r.errorMinutes);
  }
}
