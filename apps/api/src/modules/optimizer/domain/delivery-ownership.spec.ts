import { checkOwnership, isFullyOwned } from './delivery-ownership';

const MARIA = 'ficha-maria';
const JOAO = 'ficha-joao';

describe('checkOwnership', () => {
  it('aprova quando toda entrega é do motorista', () => {
    const v = checkOwnership(
      ['d1', 'd2'],
      [
        { id: 'd1', driverId: MARIA },
        { id: 'd2', driverId: MARIA },
      ],
      MARIA,
    );

    expect(isFullyOwned(v)).toBe(true);
  });

  // O caso central da ADR-0099: dois motoristas do mesmo tenant.
  it('separa a entrega do colega', () => {
    const v = checkOwnership(
      ['d1', 'd2'],
      [
        { id: 'd1', driverId: MARIA },
        { id: 'd2', driverId: JOAO },
      ],
      MARIA,
    );

    expect(v.foreign).toEqual(['d2']);
    expect(v.missing).toEqual([]);
    expect(isFullyOwned(v)).toBe(false);
  });

  // Id que o tenant não enxerga: outro tenant (a RLS o esconde) ou inexistente.
  // Os dois são "não encontrado", e a distinção não deve chegar a quem pediu.
  it('id invisível vira ausente, não alheio', () => {
    const v = checkOwnership(['d1', 'd9'], [{ id: 'd1', driverId: MARIA }], MARIA);

    expect(v.missing).toEqual(['d9']);
    expect(v.foreign).toEqual([]);
  });

  // O autônomo não tem ficha (ADR-0085): as entregas dele não têm motorista.
  it('autônomo é dono das entregas sem motorista', () => {
    const v = checkOwnership(
      ['d1', 'd2'],
      [
        { id: 'd1', driverId: null },
        { id: 'd2', driverId: null },
      ],
      null,
    );

    expect(isFullyOwned(v)).toBe(true);
  });

  // Deliberado: entrega sem motorista não é de ninguém, então quem tem ficha
  // não a otimiza. Pegar trabalho não atribuído é uma atribuição, e quem
  // atribui é o despacho.
  it('entrega sem motorista não é do motorista com ficha', () => {
    const v = checkOwnership(['d1'], [{ id: 'd1', driverId: null }], MARIA);

    expect(v.foreign).toEqual(['d1']);
  });

  // E o inverso: o autônomo não alcança entrega atribuída a alguém.
  it('autônomo não alcança entrega atribuída', () => {
    const v = checkOwnership(['d1'], [{ id: 'd1', driverId: JOAO }], null);

    expect(v.foreign).toEqual(['d1']);
  });

  it('id repetido não duplica o veredito', () => {
    const v = checkOwnership(['d1', 'd1'], [{ id: 'd1', driverId: JOAO }], MARIA);

    expect(v.foreign).toEqual(['d1']);
  });

  it('sem ids pedidos, nada a objetar', () => {
    expect(isFullyOwned(checkOwnership([], [], MARIA))).toBe(true);
  });
});
