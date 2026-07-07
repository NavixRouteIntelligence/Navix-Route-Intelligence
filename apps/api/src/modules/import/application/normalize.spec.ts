import { normalizePriority, resolveAddress } from './normalize';

describe('normalizePriority', () => {
  it.each([
    ['urgente', 'urgent'],
    ['URG', 'urgent'],
    ['alta', 'high'],
    ['high', 'high'],
    ['baixa', 'low'],
    ['low', 'low'],
    ['', 'normal'],
    [undefined, 'normal'],
    ['qualquer', 'normal'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePriority(input as string | undefined)).toBe(expected);
  });
});

describe('resolveAddress', () => {
  it('usa a geocodificação quando disponível', () => {
    const r = resolveAddress('texto ignorado', {
      latitude: -23.5,
      longitude: -46.6,
      street: 'Rua A',
      number: '10',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01000-000',
      country: 'BR',
    });
    expect(r.street).toBe('Rua A');
    expect(r.city).toBe('São Paulo');
    expect(r.postalCode).toBe('01000-000');
  });

  it('cai para defaults seguros quando não há geocodificação', () => {
    const r = resolveAddress('Rua Sem Número', null);
    expect(r.street).toBe('Rua Sem Número');
    expect(r.number).toBe('S/N');
    expect(r.postalCode).toBe('00000');
    expect(r.country).toBe('BR');
  });
});
