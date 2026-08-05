import { VEHICLE_TYPES } from '@navix/contracts';

import { resolveRoutingProfile } from './routing-profile';

describe('resolveRoutingProfile', () => {
  // O mapeamento é o contrato: todo tipo aceito pela Navix precisa de uma linha
  // explícita, ou volta a existir um `default` escondendo aproximação.
  it('todo tipo de veículo tem mapeamento declarado', () => {
    for (const tipo of VEHICLE_TYPES) {
      const m = resolveRoutingProfile(tipo);
      expect(m.profile).toBeDefined();
      expect(['exact', 'approximate']).toContain(m.fidelity);
    }
  });

  it('bicicleta usa o perfil de ciclismo, não o de carro', () => {
    expect(resolveRoutingProfile('bicycle')).toEqual({ profile: 'cycling', fidelity: 'exact' });
  });

  it('carro usa o perfil de carro, sem ressalva', () => {
    expect(resolveRoutingProfile('car')).toEqual({ profile: 'driving', fidelity: 'exact' });
  });

  // O provedor não tem perfil de camião: altura, peso e restrição urbana ficam
  // de fora, e isso precisa estar dito — não escondido num fallback.
  it('camião é aproximação declarada, com a ressalva do que fica de fora', () => {
    const m = resolveRoutingProfile('truck');

    expect(m.profile).toBe('driving');
    expect(m.fidelity).toBe('approximate');
    expect(m.caveat).toMatch(/altura|peso|centro urbano/);
  });

  it('todo tipo aproximado explica o que não representa', () => {
    for (const tipo of VEHICLE_TYPES) {
      const m = resolveRoutingProfile(tipo);
      if (m.fidelity === 'approximate') expect(m.caveat).toBeTruthy();
      else expect(m.caveat).toBeUndefined();
    }
  });

  it('sem veículo informado, mantém o comportamento legado', () => {
    expect(resolveRoutingProfile(null).profile).toBe('driving');
    expect(resolveRoutingProfile(undefined).fidelity).toBe('exact');
  });
});
