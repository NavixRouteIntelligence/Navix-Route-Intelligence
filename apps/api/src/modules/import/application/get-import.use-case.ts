import { Inject, Injectable } from '@nestjs/common';
import type { ImportPreviewResponse } from '@navix/contracts';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  IMPORT_BATCH_REPOSITORY,
  type ImportBatchRepositoryPort,
} from '../domain/ports/import-batch-repository.port';
import { toPreviewResponse } from './mappers/import.mapper';

@Injectable()
export class GetImportUseCase {
  constructor(
    @Inject(IMPORT_BATCH_REPOSITORY) private readonly repo: ImportBatchRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<ImportPreviewResponse> {
    const batch = await this.repo.findById(tenantId, id);
    if (!batch) {
      throw new NotFoundError('Importação não encontrada.');
    }
    return toPreviewResponse(batch);
  }
}
