import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import type { PageParams } from '../../../../shared/kernel/pagination';
import type {
  PagedResult,
  VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { Vehicle } from '../../domain/vehicle';
import { VehicleOrmEntity } from './vehicle.orm-entity';

/**
 * Repositório TypeORM de veículos. Toda query filtra por `tenant_id`
 * explicitamente (defesa em profundidade, além da RLS — docs/security.md §3).
 */
@Injectable()
export class VehicleRepository implements VehicleRepositoryPort {
  constructor(
    @InjectRepository(VehicleOrmEntity)
    private readonly repo: Repository<VehicleOrmEntity>,
  ) {}

  async save(vehicle: Vehicle): Promise<void> {
    await this.repo.save(this.repo.create(vehicle.snapshot()));
  }

  async findById(tenantId: string, id: string): Promise<Vehicle | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(tenantId: string, page: PageParams): Promise<PagedResult<Vehicle>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async existsByPlate(tenantId: string, plate: string, excludeId?: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { tenantId, plate, ...(excludeId ? { id: Not(excludeId) } : {}) },
    });
    return count > 0;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.repo.delete({ tenantId, id });
  }

  private toDomain(row: VehicleOrmEntity): Vehicle {
    return Vehicle.restore({
      id: row.id,
      tenantId: row.tenantId,
      plate: row.plate,
      type: row.type,
      capacity: row.capacity,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
