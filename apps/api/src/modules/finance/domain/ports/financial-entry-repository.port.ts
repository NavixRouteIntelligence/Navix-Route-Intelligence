import type { FinancialEntry } from '../financial-entry';

/** Port do repositório do ledger financeiro. Toda operação é escopada por `tenantId`. */
export interface FinancialEntryRepositoryPort {
  save(entry: FinancialEntry): Promise<void>;
  findById(tenantId: string, id: string): Promise<FinancialEntry | null>;
  /** Lançamentos num intervalo [from, to] (datas inclusive), mais recentes primeiro. */
  findInRange(tenantId: string, from: Date, to: Date): Promise<FinancialEntry[]>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const FINANCIAL_ENTRY_REPOSITORY = Symbol('FINANCIAL_ENTRY_REPOSITORY');
