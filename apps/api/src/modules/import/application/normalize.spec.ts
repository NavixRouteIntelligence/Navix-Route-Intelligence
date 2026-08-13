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
      confidence: 'exact',
      accuracy: 'rooftop',
      needsReview: false,
      reviewReason: null,
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

describe('resolveAddress sem geocodificação', () => {
  it('usa o país do tenant quando a linha trouxe as próprias coordenadas', () => {
    // Antes ficava `BR` fixo, e um tenant português que importasse com
    // latitude e longitude no ficheiro via tudo carimbado como Brasil.
    expect(resolveAddress('Rua Augusta 100', null, 'pt').country).toBe('PT');
  });

  it('sem país do tenant, mantém o comportamento anterior', () => {
    // Retrocompatibilidade: quem não passa o país recebe o que sempre recebeu.
    expect(resolveAddress('Rua A', null).country).toBe('BR');
  });

  it('o país da geocodificação ganha ao do tenant', () => {
    // Uma entrega portuguesa num tenant brasileiro é possível, e quem sabe o
    // país é quem resolveu a morada.
    const geo = {
      latitude: 38.7,
      longitude: -9.1,
      country: 'PT',
      confidence: 'exact' as const,
      accuracy: 'rooftop' as const,
      needsReview: false,
      reviewReason: null,
    };

    expect(resolveAddress('Rua Augusta', geo, 'br').country).toBe('PT');
  });
});
