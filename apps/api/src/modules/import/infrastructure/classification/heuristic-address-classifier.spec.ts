import { HeuristicAddressClassifier } from './heuristic-address-classifier';

describe('HeuristicAddressClassifier', () => {
  const c = new HeuristicAddressClassifier();

  it('classifica condomínio/apartamento', () => {
    expect(c.classify('Condomínio Solar, Bloco B, Apto 302', null)).toBe('condo');
  });

  it('classifica empresa', () => {
    expect(c.classify('Av. Paulista 1000', 'Acme Ltda')).toBe('company');
  });

  it('classifica comércio', () => {
    expect(c.classify('Shopping Center Norte, Loja 12', null)).toBe('commerce');
  });

  it('classifica residência', () => {
    expect(c.classify('Rua das Flores 45, Casa', null)).toBe('residence');
  });

  it('retorna unknown quando não há pistas', () => {
    expect(c.classify('Zona rural km 3', null)).toBe('unknown');
  });
});
