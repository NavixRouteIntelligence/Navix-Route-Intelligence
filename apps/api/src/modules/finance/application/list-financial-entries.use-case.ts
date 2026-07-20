import { Inject, Injectable } from '@nestjs/common';
import type { FinancialEntry as FinancialEntryView } from '@navix/contracts';

import {
  FINANCIAL_ENTRY_REPOSITORY,
  type FinancialEntryRepositoryPort,
} from '../domain/ports/financial-entry-repository.port';
import { toFinancialEntryView } from './financial-entry.mapper';

@Injectable()
export class ListFinancialEntriesUseCase {
  constructor(
    @Inject(FINANCIAL_ENTRY_REPOSITORY) private readonly entries: FinancialEntryRepositoryPort,
  ) {}

  async execute(tenantId: string, from: Date, to: Date): Promise<FinancialEntryView[]> {
    const entries = await this.entries.findInRange(tenantId, from, to);
    return entries.map(toFinancialEntryView);
  }
}
