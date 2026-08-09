import type { DriverDailySnapshot } from '@navix/contracts';

import type { Indicator, PersonalBaseline } from './driver-baseline';
import {
  MAX_HIGHLIGHTS,
  SHORT_HISTORY_SAMPLE,
  confidenceOf,
  deltaOf,
  highlightsOf,
} from './kaizen-daily';

function ind(over: Partial<Indicator> = {}): Indicator {
  return { current: 12, baseline: 10, trend: 'stable', sample: 8, ...over };
}

function base(over: Partial<PersonalBaseline> = {}): PersonalBaseline {
  return {
    day: '2026-08-08',
    delivered: ind(),
    successRate: ind({ current: 1, baseline: 1 }),
    onTimeRate: { ...ind({ current: 1, baseline: 1 }), informative: true },
    activeMinutes: { ...ind({ current: 200, baseline: 200 }), informative: true },
    ...over,
  };
}

function foto(over: Partial<DriverDailySnapshot> = {}): DriverDailySnapshot {
  return {
    day: '2026-08-08',
    state: 'ok',
    delivered: 12,
    failed: 0,
    onTime: 12,
    successRate: 1,
    onTimeRate: 1,
    activeMinutes: 200,
    savings: null,
    projectedAt: '2026-08-09T02:00:00.000Z',
    timeZone: 'Europe/Lisbon',
    timeZoneSource: 'user',
    settled: true,
    ...over,
  };
}

describe('deltaOf', () => {
  it('devolve a diferença absoluta e a relativa', () => {
    expect(deltaOf(ind({ current: 15, baseline: 10 }))).toEqual({
      absolute: 5,
      relative: 0.5,
      trend: 'stable',
    });
  });

  it('referência zero não tem variação relativa', () => {
    // Dividir por zero daria infinito, e arredondá-lo para 100% inventaria uma
    // escala que não existe.
    expect(deltaOf(ind({ current: 3, baseline: 0 }))).toMatchObject({
      absolute: 3,
      relative: null,
    });
  });

  it('sem referência, não há delta nenhum', () => {
    expect(deltaOf(ind({ current: 3, baseline: null, trend: 'building-history' }))).toEqual({
      absolute: null,
      relative: null,
      trend: 'building-history',
    });
  });

  it('sem valor atual, também não há', () => {
    expect(deltaOf(ind({ current: null }))).toMatchObject({ absolute: null, relative: null });
  });
});

describe('highlightsOf', () => {
  it('um dia sem nada fora do habitual não tem destaques', () => {
    expect(highlightsOf(base())).toEqual([]);
  });

  it('só entram indicadores que saíram do habitual', () => {
    const r = highlightsOf(base({ delivered: ind({ trend: 'improved' }) }));

    expect(r).toEqual([{ metric: 'delivered', trend: 'improved', informative: false }]);
  });

  // Descanso primeiro: um dia longo importa mais do que um bom número de
  // entregas, mesmo quando os dois mudaram.
  it('descanso vem antes de entregas quando ambos mudaram', () => {
    const r = highlightsOf(
      base({
        delivered: ind({ trend: 'improved' }),
        activeMinutes: { ...ind({ trend: 'attention' }), informative: true },
      }),
    );

    expect(r[0].metric).toBe('activeMinutes');
    expect(r[0].informative).toBe(true);
  });

  it(`no máximo ${MAX_HIGHLIGHTS} — uma lista de seis não destaca nada`, () => {
    const r = highlightsOf(
      base({
        delivered: ind({ trend: 'improved' }),
        successRate: ind({ trend: 'attention' }),
        onTimeRate: { ...ind({ trend: 'improved' }), informative: true },
        activeMinutes: { ...ind({ trend: 'attention' }), informative: true },
      }),
    );

    expect(r).toHaveLength(MAX_HIGHLIGHTS);
  });

  it('"a construir histórico" não é destaque', () => {
    expect(highlightsOf(base({ delivered: ind({ trend: 'building-history' }) }))).toEqual([]);
  });
});

describe('confidenceOf', () => {
  it('dado completo e histórico suficiente: confiança alta e sem ressalvas', () => {
    const r = confidenceOf(foto(), base());

    expect(r).toEqual({ confidence: 'high', reasons: [] });
  });

  it('uma ressalva baixa a confiança para média', () => {
    const r = confidenceOf(foto(), base({ delivered: ind({ sample: SHORT_HISTORY_SAMPLE - 1 }) }));

    expect(r.confidence).toBe('medium');
    expect(r.reasons).toEqual(['short-history']);
  });

  it('duas ressalvas baixam para baixa', () => {
    const r = confidenceOf(
      foto({ state: 'incomplete', activeMinutes: null }),
      base({ delivered: ind({ sample: 2 }) }),
    );

    expect(r.confidence).toBe('low');
    expect(r.reasons).toEqual(['activity-unknown', 'short-history']);
  });

  // Projeção pendente é ausência de dado, não dado fraco: nada do que está no
  // ecrã foi lido do read model.
  it('projeção pendente é sempre confiança baixa', () => {
    const r = confidenceOf(foto({ state: 'pending', activeMinutes: null }), base());

    expect(r.confidence).toBe('low');
    expect(r.reasons).toContain('projection-pending');
  });

  it('dia de folga é declarado, não escondido', () => {
    const r = confidenceOf(foto({ state: 'no-work', activeMinutes: null }), base());

    expect(r.reasons).toContain('no-work');
  });

  it('sem baseline nenhum, o histórico curto é declarado', () => {
    expect(confidenceOf(foto(), null).reasons).toContain('short-history');
  });

  // Uma lista de razões vazia é informação: significa que nada foi omitido nem
  // aproximado.
  it('confiança alta só existe com a lista de razões vazia', () => {
    const r = confidenceOf(foto({ activeMinutes: null, state: 'incomplete' }), base());

    expect(r.confidence).not.toBe('high');
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});
