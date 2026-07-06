import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import type { PageParams } from '../../../../shared/kernel/pagination';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import type {
  DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import type { PagedResult } from '../../domain/ports/vehicle-repository.port';
import { Driver } from '../../domain/driver';
import { DriverOrmEntity } from './driver.orm-entity';

/** Repositório TypeORM de motoristas. Escopo via transação (RLS) + filtro por tenant. */
@Injectable()
export class DriverRepository implements DriverRepositoryPort {
  constructor(
    @InjectRepository(DriverOrmEntity)
    private readonly base: Repository<DriverOrmEntity>,
  ) {}

  private get repo(): Repository<DriverOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(driver: Driver): Promise<void> {
    await this.repo.save(this.repo.create(driver.snapshot()));
  }

  async findById(tenantId: string, id: string): Promise<Driver | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(tenantId: string, page: PageParams): Promise<PagedResult<Driver>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async existsByLicense(
    tenantId: string,
    licenseNumber: string,
    excludeId?: string,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: { tenantId, licenseNumber, ...(excludeId ? { id: Not(excludeId) } : {}) },
    });
    return count > 0;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.repo.delete({ tenantId, id });
  }

  private toDomain(row: DriverOrmEntity): Driver {
    return Driver.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      licenseNumber: row.licenseNumber,
      skills: row.skills,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
