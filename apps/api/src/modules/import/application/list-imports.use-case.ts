import { Inject, Injectable } from '@nestjs/common';
import type { ImportBatchView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../shared/kernel/pagination';
import {
  IMPORT_BATCH_REPOSITORY,
  type ImportBatchRepositoryPort,
} from '../domain/ports/import-batch-repository.port';
import { toBatchView } from './mappers/import.mapper';

export interface ListImportsResult {
  items: ImportBatchView[];
  total: number;
  page: PageParams;
}

@Injectable()
export class ListImportsUseCase {
  constructor(
    @Inject(IMPORT_BATCH_REPOSITORY) private readonly repo: ImportBatchRepositoryPort,
  ) {}

  async execute(tenantId: string, page?: number, pageSize?: number): Promise<ListImportsResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.repo.findAll(tenantId, params);
    return { items: items.map(toBatchView), total, page: params };
  }
}
