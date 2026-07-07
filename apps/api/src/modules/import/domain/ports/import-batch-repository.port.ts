import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import type { ImportBatch } from '../import-batch';

export interface ImportBatchRepositoryPort {
  save(batch: ImportBatch): Promise<void>;
  findById(tenantId: string, id: string): Promise<ImportBatch | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<ImportBatch>>;
}

export const IMPORT_BATCH_REPOSITORY = Symbol('IMPORT_BATCH_REPOSITORY');
