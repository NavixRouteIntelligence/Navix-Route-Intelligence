import { ECONOMY_PRESETS, weightsFor } from './economy';
import { describeObjective } from './objective-breakdown';
import { compositeCost } from './route-cost-model';
import type { StrategyContext } from './ports/route-optimization-strategy.port';

/**
 * NAV-4.12 / ADR-0111: cenário controlado em que **distância, tempo e custo
 * discordam**. É o único jeito de provar que cada objetivo otimiza o que diz —
 * enquanto os três apontassem para a mesma rota, qualquer função de custo
 * pareceria correta.
 *
 * Três nós, duas ordens possíveis a partir de 0:
 *
 *  - `0 → 1 → 2` : **curta** em km, **lenta** (congestionada), **com portagem**.
 *  - `0 → 2 → 1` : longa em km, **rápida** (via livre), **sem portagem**.
 */
function cenario(weights: StrategyContext['weights']): StrategyContext {
  const km = [
    [0, 10, 30],
    [10, 0, 10],
    [30, 10, 0],
  ];
  // O trecho curto 0→1 é o mais lento: 60 min para 10 km (trânsito parado).
  const min = [
    [0, 60, 30],
    [60, 0, 20],
    [30, 20, 0],
  ];
  // Só o trecho 0→1 passa em pórtico.
  const toll = [
    [0, 8, 0],
    [8, 0, 0],
    [0, 0, 0],
  ];
  return {
    size: 3,
    distanceMatrix: km,
    timeMatrix: min,
    tollMatrix: toll,
    priorities: [0, 0, 0],
    windows: [null, null, null],
    serviceTimeMinutes: 0,
    hasOrigin: true,
    weights,
  };
}

const CURTA_LENTA_COM_PORTAGEM = [0, 1, 2];
const LONGA_RAPIDA_SEM_PORTAGEM = [0, 2, 1];

/** Custo das duas ordens sob um preset. */
function comparar(mode: Parameters<typeof weightsFor>[0]) {
  const ctx = cenario(weightsFor(mode));
  return {
    curta: compositeCost(ctx, CURTA_LENTA_COM_PORTAGEM),
    longa: compositeCost(ctx, LONGA_RAPIDA_SEM_PORTAGEM),
  };
}

describe('objetivos em cenário de conflito', () => {
  // Sanidade do cenário: as três grandezas de fato discordam.
  it('o cenário é conflituoso: a rota curta é a mais lenta e a única com portagem', () => {
    const ctx = cenario(weightsFor(undefined));

    const km = (o: number[]) => o.slice(1).reduce((a, n, i) => a + ctx.distanceMatrix[o[i]][n], 0);
    const minutos = (o: number[]) => o.slice(1).reduce((a, n, i) => a + ctx.timeMatrix[o[i]][n], 0);
    const portagem = (o: number[]) =>
      o.slice(1).reduce((a, n, i) => a + ctx.tollMatrix![o[i]][n], 0);

    expect(km(CURTA_LENTA_COM_PORTAGEM)).toBeLessThan(km(LONGA_RAPIDA_SEM_PORTAGEM));
    expect(minutos(CURTA_LENTA_COM_PORTAGEM)).toBeGreaterThan(minutos(LONGA_RAPIDA_SEM_PORTAGEM));
    expect(portagem(CURTA_LENTA_COM_PORTAGEM)).toBeGreaterThan(portagem(LONGA_RAPIDA_SEM_PORTAGEM));
  });

  it('menor consumo escolhe a rota mais curta', () => {
    const { curta, longa } = comparar('fuel');

    expect(curta).toBeLessThan(longa);
  });

  // O defeito que a ADR-0111 fecha: sem termo de duração, "menor tempo"
  // escolhia a rota **mais lenta**, porque só olhava distância e janela.
  it('menor tempo escolhe a rota mais rápida, ainda que mais longa', () => {
    const { curta, longa } = comparar('time');

    expect(longa).toBeLessThan(curta);
  });

  it('menor portagem escolhe a rota sem pórtico, ainda que mais longa', () => {
    const { curta, longa } = comparar('tolls');

    expect(longa).toBeLessThan(curta);
  });

  // Sem o termo de duração — como era antes —, "menor tempo" preferiria a curta.
  it('sem peso de duração, o objetivo de tempo volta a escolher pela distância', () => {
    const semDuracao = { ...ECONOMY_PRESETS.time, duration: 0 };
    const ctx = cenario(semDuracao);

    expect(compositeCost(ctx, CURTA_LENTA_COM_PORTAGEM)).toBeLessThan(
      compositeCost(ctx, LONGA_RAPIDA_SEM_PORTAGEM),
    );
  });

  it('o override do operador muda a escolha', () => {
    // Peso de portagem alto o bastante para vencer a distância no modo padrão.
    const ctx = cenario(weightsFor(undefined, { balanced: { toll: 5 } }));

    expect(compositeCost(ctx, LONGA_RAPIDA_SEM_PORTAGEM)).toBeLessThan(
      compositeCost(ctx, CURTA_LENTA_COM_PORTAGEM),
    );
  });
});

describe('describeObjective', () => {
  it('lista só os componentes que entraram, com os pesos usados', () => {
    const b = describeObjective(weightsFor('time'), true);

    expect(b.components).toContain('duration');
    expect(b.components).toContain('distance');
    expect(b.weights.duration).toBe(ECONOMY_PRESETS.time.duration);
    expect(b.tollData).toBe('configured');
  });

  // Peso de portagem sem dados não é componente: declará-lo faria parecer que a
  // rota considerou portagem.
  it('sem dados de portagem, o componente não entra e a ausência é declarada', () => {
    const b = describeObjective(weightsFor('tolls'), false);

    expect(b.components).not.toContain('toll');
    expect(b.weights.toll).toBeUndefined();
    expect(b.tollData).toBe('absent');
  });

  it('componente com peso zero não aparece', () => {
    const b = describeObjective({ distance: 1, duration: 0, timeWindow: 0, priority: 0.05 }, false);

    expect(b.components).toEqual(['distance', 'priority']);
  });
});
