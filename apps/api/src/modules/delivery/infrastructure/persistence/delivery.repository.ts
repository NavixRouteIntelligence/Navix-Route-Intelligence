import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import type { PagedResult } from '../../../../shared/kernel/pagination';
import type { NormalizedSync } from '../../../../shared/kernel/sync';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { ListDeliveriesQuery } from '../../application/queries/list-deliveries.query';
import { Delivery } from '../../domain/delivery';
import type {
  DeliveryChanges,
  DeliveryRepositoryPort,
} from '../../domain/ports/delivery-repository.port';
import { Address } from '../../domain/value-objects/address';
import { TimeWindow } from '../../domain/value-objects/time-window';
import { DeliveryOrmEntity } from './delivery.orm-entity';

const SORT_COLUMNS: Record<string, string> = {
  createdAt: 'delivery.created_at',
  windowStart: 'delivery.window_start',
};

const PRIORITY_ORDER = `CASE delivery.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END`;

/** Repositório TypeORM de entregas. Filtra por tenant e exclui soft-deletadas. */
@Injectable()
export class DeliveryRepository implements DeliveryRepositoryPort {
  constructor(
    @InjectRepository(DeliveryOrmEntity)
    private readonly base: Repository<DeliveryOrmEntity>,
  ) {}

  private get repo(): Repository<DeliveryOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(delivery: Delivery): Promise<void> {
    const s = delivery.snapshot();
    const a = s.address.snapshot();
    await this.repo.save(
      this.repo.create({
        id: s.id,
        tenantId: s.tenantId,
        street: a.street,
        number: a.number,
        complement: a.complement,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        latitude: a.latitude,
        longitude: a.longitude,
        priority: s.priority,
        windowStart: s.timeWindow.start,
        windowEnd: s.timeWindow.end,
        status: s.status,
        driverId: s.driverId,
        vehicleId: s.vehicleId,
        routeId: s.routeId,
        notes: s.notes,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        deletedAt: s.deletedAt,
      }),
    );
  }

  async findById(tenantId: string, id: string): Promise<Delivery | null> {
    const row = await this.repo
      .createQueryBuilder('delivery')
      .where('delivery.tenant_id = :tenantId', { tenantId })
      .andWhere('delivery.id = :id', { id })
      .andWhere('delivery.deleted_at IS NULL')
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Delivery[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo
      .createQueryBuilder('delivery')
      .where('delivery.tenant_id = :tenantId', { tenantId })
      .andWhere('delivery.id IN (:...ids)', { ids })
      .andWhere('delivery.deleted_at IS NULL')
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async findAll(tenantId: string, query: ListDeliveriesQuery): Promise<PagedResult<Delivery>> {
    const qb = this.repo
      .createQueryBuilder('delivery')
      .where('delivery.tenant_id = :tenantId', { tenantId })
      .andWhere('delivery.deleted_at IS NULL');

    this.applyFilters(qb, query);
    this.applySort(qb, query);

    qb.skip((query.page.page - 1) * query.page.pageSize).take(query.page.pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async findChangedSince(tenantId: string, params: NormalizedSync): Promise<DeliveryChanges> {
    // Feed de sync: keyset por (updated_at, id), INCLUINDO tombstones (sem o
    // filtro deleted_at IS NULL), para o cache offline remover o que sumiu.
    const qb = this.repo
      .createQueryBuilder('delivery')
      .where('delivery.tenant_id = :tenantId', { tenantId })
      .orderBy('delivery.updated_at', 'ASC')
      .addOrderBy('delivery.id', 'ASC')
      // Busca uma linha a mais para saber se há próxima página sem um COUNT.
      .take(params.limit + 1);

    if (params.cursor) {
      // Comparação por row value: (updated_at, id) > (cursor). Estável e usa o índice.
      qb.andWhere('(delivery.updated_at, delivery.id) > (:curT, :curId)', {
        curT: params.cursor.updatedAt.toISOString(),
        curId: params.cursor.id,
      });
    } else if (params.since) {
      qb.andWhere('delivery.updated_at >= :since', { since: params.since.toISOString() });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;
    return { items: page.map((r) => this.toDomain(r)), hasMore };
  }

  private applyFilters(qb: SelectQueryBuilder<DeliveryOrmEntity>, query: ListDeliveriesQuery): void {
    const f = query.filters;
    if (f.status) qb.andWhere('delivery.status = :status', { status: f.status });
    if (f.priority) qb.andWhere('delivery.priority = :priority', { priority: f.priority });
    if (f.driverId) qb.andWhere('delivery.driver_id = :driverId', { driverId: f.driverId });
    if (f.vehicleId) qb.andWhere('delivery.vehicle_id = :vehicleId', { vehicleId: f.vehicleId });
    if (f.routeId) qb.andWhere('delivery.route_id = :routeId', { routeId: f.routeId });
    if (f.windowFrom) qb.andWhere('delivery.window_start >= :windowFrom', { windowFrom: f.windowFrom });
    if (f.windowTo) qb.andWhere('delivery.window_start <= :windowTo', { windowTo: f.windowTo });
  }

  private applySort(qb: SelectQueryBuilder<DeliveryOrmEntity>, query: ListDeliveriesQuery): void {
    if (query.sort.length === 0) {
      qb.orderBy('delivery.created_at', 'DESC');
      return;
    }
    query.sort.forEach((s, index) => {
      const expr = s.field === 'priority' ? PRIORITY_ORDER : SORT_COLUMNS[s.field];
      if (index === 0) qb.orderBy(expr, s.direction);
      else qb.addOrderBy(expr, s.direction);
    });
  }

  private toDomain(row: DeliveryOrmEntity): Delivery {
    return Delivery.restore({
      id: row.id,
      tenantId: row.tenantId,
      address: Address.restore({
        street: row.street,
        number: row.number,
        complement: row.complement,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude,
      }),
      priority: row.priority,
      timeWindow: TimeWindow.restore(row.windowStart, row.windowEnd),
      status: row.status,
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      routeId: row.routeId,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
