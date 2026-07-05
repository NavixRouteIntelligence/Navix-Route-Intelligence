import { ValidationError } from '../../../shared/kernel/domain-error';
import { Vehicle } from './vehicle';

describe('Vehicle (domínio)', () => {
  const base = { tenantId: 'tenant-1', plate: 'abc1d23', type: 'van' as const, capacity: 500 };

  it('cria um veículo válido normalizando a placa e status padrão', () => {
    const v = Vehicle.create(base).snapshot();
    expect(v.plate).toBe('ABC1D23');
    expect(v.status).toBe('active');
    expect(v.id).toBeDefined();
    expect(v.createdAt).toBeInstanceOf(Date);
  });

  it('rejeita placa curta', () => {
    expect(() => Vehicle.create({ ...base, plate: 'ab' })).toThrow(ValidationError);
  });

  it('rejeita capacidade não positiva ou não inteira', () => {
    expect(() => Vehicle.create({ ...base, capacity: 0 })).toThrow(ValidationError);
    expect(() => Vehicle.create({ ...base, capacity: 10.5 })).toThrow(ValidationError);
  });

  it('rejeita tipo inválido', () => {
    expect(() =>
      Vehicle.create({ ...base, type: 'spaceship' as unknown as 'van' }),
    ).toThrow(ValidationError);
  });

  it('atualiza campos e move updatedAt', () => {
    const v = Vehicle.create(base);
    const before = v.snapshot().updatedAt.getTime();
    v.update({ capacity: 800, status: 'maintenance' });
    const after = v.snapshot();
    expect(after.capacity).toBe(800);
    expect(after.status).toBe('maintenance');
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
