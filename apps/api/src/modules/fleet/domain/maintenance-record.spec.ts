import { ValidationError } from '../../../shared/kernel/domain-error';
import { MaintenanceRecord } from './maintenance-record';

const base = {
  tenantId: 't1',
  vehicleId: 'v1',
  type: 'oil_change' as const,
  performedAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('MaintenanceRecord', () => {
  it('cria com os campos normalizados', () => {
    const r = MaintenanceRecord.create({
      ...base,
      odometerKm: 120000,
      costCents: 4599,
      notes: '  troca completa  ',
      nextDueOdometerKm: 130000,
    }).snapshot();
    expect(r.type).toBe('oil_change');
    expect(r.odometerKm).toBe(120000);
    expect(r.costCents).toBe(4599);
    expect(r.notes).toBe('troca completa'); // trim
    expect(r.nextDueOdometerKm).toBe(130000);
    expect(r.nextDueDate).toBeNull();
  });

  it('notas vazias viram null', () => {
    expect(MaintenanceRecord.create({ ...base, notes: '   ' }).snapshot().notes).toBeNull();
  });

  it('rejeita tipo inválido', () => {
    expect(() => MaintenanceRecord.create({ ...base, type: 'foo' as never })).toThrow(ValidationError);
  });

  it('rejeita km negativo ou não-inteiro', () => {
    expect(() => MaintenanceRecord.create({ ...base, odometerKm: -1 })).toThrow(ValidationError);
    expect(() => MaintenanceRecord.create({ ...base, odometerKm: 1.5 })).toThrow(ValidationError);
  });

  it('rejeita custo negativo', () => {
    expect(() => MaintenanceRecord.create({ ...base, costCents: -100 })).toThrow(ValidationError);
  });

  it('rejeita data inválida', () => {
    expect(() => MaintenanceRecord.create({ ...base, performedAt: new Date('nope') })).toThrow(ValidationError);
  });

  it('rejeita notas acima de 500 caracteres', () => {
    expect(() => MaintenanceRecord.create({ ...base, notes: 'x'.repeat(501) })).toThrow(ValidationError);
  });
});
