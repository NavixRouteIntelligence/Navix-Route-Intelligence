import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import { scopedRepository } from '../../../../shared/database/transaction-context';
import { ImportBatch } from '../../domain/import-batch';
import type { ImportBatchRepositoryPort } from '../../domain/ports/import-batch-repository.port';
import { ImportBatchOrmEntity } from './import-batch.orm-entity';

@Injectable()
export class ImportBatchRepository implements ImportBatchRepositoryPort {
  constructor(
    @InjectRepository(ImportBatchOrmEntity)
    private readonly base: Repository<ImportBatchOrmEntity>,
  ) {}

  private get repo(): Repository<ImportBatchOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(batch: ImportBatch): Promise<void> {
    const s = batch.snapshot();
    const row = new ImportBatchOrmEntity();
    row.id = s.id;
    row.tenantId = s.tenantId;
    row.createdBy = s.createdBy;
    row.filename = s.filename;
    row.fileType = s.fileType;
    row.status = s.status;
    row.summary = s.summary;
    row.rows = s.rows;
    row.createdDeliveries = s.createdDeliveries;
    row.routePlanId = s.routePlanId;
    row.createdAt = s.createdAt;
    row.importedAt = s.importedAt;
    await this.repo.save(row);
  }

  async findById(tenantId: string, id: string): Promise<ImportBatch | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(tenantId: string, page: PageParams): Promise<PagedResult<ImportBatch>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: ImportBatchOrmEntity): ImportBatch {
    return ImportBatch.restore({
      id: row.id,
      tenantId: row.tenantId,
      createdBy: row.createdBy,
      filename: row.filename,
      fileType: row.fileType,
      status: row.status,
      summary: row.summary,
      rows: row.rows,
      createdDeliveries: row.createdDeliveries,
      routePlanId: row.routePlanId,
      createdAt: row.createdAt,
      importedAt: row.importedAt,
    });
  }
}
