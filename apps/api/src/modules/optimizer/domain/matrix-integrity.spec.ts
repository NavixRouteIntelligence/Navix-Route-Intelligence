import { assertFiniteCells, assertMatrixShape, normalizeCell } from './matrix-integrity';
import { UNREACHABLE } from './reachability';

const GEO = { km: 5, minutes: 10 };

describe('normalizeCell', () => {
  it('com os dois números, usa os do provedor', () => {
    expect(normalizeCell({ meters: 2000, seconds: 300 }, GEO)).toEqual({ km: 2, minutes: 5 });
  });

  // Os dois nulos: o provedor está a dizer que não há rota (ADR-0106).
  it('os dois nulos viram proibido, nunca zero', () => {
    expect(normalizeCell({ meters: null, seconds: null }, GEO)).toEqual({
      km: UNREACHABLE,
      minutes: UNREACHABLE,
    });
  });

  // O defeito que esta ADR corrige: o par é alcançável, só falta o tempo.
  // Marcá-lo proibido apagaria uma perna que existe.
  it('sem duração, usa a duração geométrica — e mantém a distância medida', () => {
    expect(normalizeCell({ meters: 2000, seconds: null }, GEO)).toEqual({ km: 2, minutes: 10 });
  });

  it('sem distância, usa a distância geométrica — e mantém a duração medida', () => {
    expect(normalizeCell({ meters: null, seconds: 300 }, GEO)).toEqual({ km: 5, minutes: 5 });
  });

  // Duração zero num trecho com distância diria que a viagem é instantânea, e
  // um objetivo de tempo (ADR-0111) escolheria exatamente esse trecho.
  it('nunca produz duração zero num trecho com distância', () => {
    const c = normalizeCell({ meters: 2000, seconds: null }, GEO);

    expect(c.minutes).toBeGreaterThan(0);
  });

  it('zero medido continua zero: é a diagonal', () => {
    expect(normalizeCell({ meters: 0, seconds: 0 }, GEO)).toEqual({ km: 0, minutes: 0 });
  });
});

describe('assertMatrixShape', () => {
  const ok = [
    [1, 2],
    [3, 4],
  ];

  it('aceita a forma prometida', () => {
    expect(() => assertMatrixShape(ok, 2, 2, 'distância')).not.toThrow();
  });

  it('recusa matriz ausente', () => {
    expect(() => assertMatrixShape(undefined, 2, 2, 'distância')).toThrow(/esperado 2/);
  });

  it('recusa número de linhas diferente', () => {
    expect(() => assertMatrixShape([[1, 2]], 2, 2, 'duração')).toThrow(/1 linhas/);
  });

  // Era isto que virava proibição silenciosa: `?.[b] ?? null` numa linha curta.
  it('recusa linha truncada, dizendo qual', () => {
    expect(() => assertMatrixShape([[1, 2], [3]], 2, 2, 'distância')).toThrow(/linha 1/);
  });
});

describe('assertFiniteCells', () => {
  it('`null` é legítimo: significa ausência', () => {
    expect(() => assertFiniteCells([[null, 1]], 'distância')).not.toThrow();
  });

  // `NaN` compara falso com tudo e faz o solver escolher ao acaso.
  it('recusa NaN', () => {
    expect(() => assertFiniteCells([[Number.NaN]], 'duração')).toThrow(/\[0\]\[0\]/);
  });

  it('recusa infinito vindo do provedor', () => {
    expect(() => assertFiniteCells([[Number.POSITIVE_INFINITY]], 'distância')).toThrow(/inválido/);
  });

  it('recusa negativo — distância negativa não existe', () => {
    expect(() => assertFiniteCells([[0, -1]], 'distância')).toThrow(/\[0\]\[1\]/);
  });

  it('aceita zero', () => {
    expect(() => assertFiniteCells([[0]], 'duração')).not.toThrow();
  });
});
