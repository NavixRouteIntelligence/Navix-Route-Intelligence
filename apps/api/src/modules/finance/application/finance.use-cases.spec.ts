import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { FinancialEntry } from '../domain/financial-entry';
import type { FinancialEntryRepositoryPort } from '../domain/ports/financial-entry-repository.port';
import { CreateFinancialEntryUseCase } from './create-financial-entry.use-case';
import { DeleteFinancialEntryUseCase } from './delete-financial-entry.use-case';
import { GetFinancialSummaryUseCase } from './get-financial-summary.use-case';
import type { DeliveryCountPort } from './ports/delivery-count.port';

const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

function repo(overrides: Partial<FinancialEntryRepositoryPort> = {}): FinancialEntryRepositoryPort {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findInRange: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const deliveryCount = (n: number): DeliveryCountPort => ({
  countDeliveredInRange: jest.fn().mockResolvedValue(n),
});

function entry(type: 'income' | 'expense', euros: number, category = 'other', odometerKm: number | null = null): FinancialEntry {
  return FinancialEntry.create({
    tenantId: 't1',
    type,
    category: category as never,
    amountCents: Math.round(euros * 100),
    occurredAt: new Date('2026-07-10T00:00:00.000Z'),
    odometerKm,
  });
}

describe('CreateFinancialEntryUseCase', () => {
  it('cria convertendo euros → cents e devolve a view em euros', async () => {
    const r = repo();
    const uc = new CreateFinancialEntryUseCase(r, audit);
    const view = await uc.execute({
      tenantId: 't1',
      type: 'expense',
      category: 'fuel',
      amount: 62.5,
      occurredAt: '2026-07-10',
      liters: 40,
      odometerKm: 100000,
    });
    expect(view.amount).toBe(62.5);
    expect(view.category).toBe('fuel');
    expect(r.save).toHaveBeenCalledTimes(1);
  });
});

describe('GetFinancialSummaryUseCase', () => {
  it('deriva custo/km e lucro/entrega do ledger + entregas', async () => {
    const entries = [
      entry('income', 200),
      entry('expense', 60, 'fuel', 100000),
      entry('expense', 65, 'fuel', 100400),
    ];
    const uc = new GetFinancialSummaryUseCase(repo({ findInRange: jest.fn().mockResolvedValue(entries) }), deliveryCount(4));
    const s = await uc.execute('t1', new Date('2026-07-01'), new Date('2026-07-31'));
    expect(s.totalIncome).toBe(200);
    expect(s.totalExpense).toBe(125);
    expect(s.balance).toBe(75);
    expect(s.distanceKm).toBe(400);
    expect(s.costPerKm).toBe(0.31);
    expect(s.deliveries).toBe(4);
    expect(s.profitPerDelivery).toBe(18.75); // 75 / 4
  });
});

describe('DeleteFinancialEntryUseCase', () => {
  it('404 quando o lançamento não existe', async () => {
    const uc = new DeleteFinancialEntryUseCase(repo({ findById: jest.fn().mockResolvedValue(null) }), audit);
    await expect(uc.execute('t1', 'x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('apaga quando existe', async () => {
    const r = repo({ findById: jest.fn().mockResolvedValue(entry('income', 10)) });
    const uc = new DeleteFinancialEntryUseCase(r, audit);
    await uc.execute('t1', 'x');
    expect(r.delete).toHaveBeenCalledWith('t1', 'x');
  });
});
