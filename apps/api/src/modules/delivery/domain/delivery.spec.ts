import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import { Delivery, type CreateDeliveryInput } from './delivery';

const baseInput: CreateDeliveryInput = {
  tenantId: 'tenant-1',
  address: {
    street: 'Av. Paulista',
    number: '1000',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01310-100',
    country: 'br',
    latitude: -23.561,
    longitude: -46.656,
  },
  timeWindow: { start: '2026-07-06T09:00:00Z', end: '2026-07-06T12:00:00Z' },
};

describe('Delivery (domínio)', () => {
  it('cria com status pending e normaliza país/prioridade padrão', () => {
    const d = Delivery.create(baseInput).snapshot();
    expect(d.status).toBe('pending');
    expect(d.priority).toBe('normal');
    expect(d.address.snapshot().country).toBe('BR');
  });

  it('rejeita coordenada fora de faixa', () => {
    expect(() =>
      Delivery.create({ ...baseInput, address: { ...baseInput.address, latitude: 100 } }),
    ).toThrow(ValidationError);
  });

  it('rejeita janela com início após o fim', () => {
    expect(() =>
      Delivery.create({
        ...baseInput,
        timeWindow: { start: '2026-07-06T12:00:00Z', end: '2026-07-06T09:00:00Z' },
      }),
    ).toThrow(ValidationError);
  });

  it('segue a máquina de estados: pending → in_route → delivered', () => {
    const d = Delivery.create(baseInput);
    d.changeStatus('in_route');
    d.changeStatus('delivered');
    expect(d.status).toBe('delivered');
  });

  it('bloqueia transição inválida', () => {
    const d = Delivery.create(baseInput);
    expect(() => d.changeStatus('delivered')).toThrow(ConflictError); // pending → delivered não permitido
  });

  it('não permite editar entrega em estado terminal', () => {
    const d = Delivery.create(baseInput);
    d.changeStatus('canceled');
    expect(() => d.update({ notes: 'tentativa' })).toThrow(ConflictError);
  });

  it('soft delete é idempotente e marca deletedAt', () => {
    const d = Delivery.create(baseInput);
    d.softDelete();
    const first = d.snapshot().deletedAt;
    d.softDelete();
    expect(first).not.toBeNull();
    expect(d.snapshot().deletedAt).toBe(first);
  });
});
