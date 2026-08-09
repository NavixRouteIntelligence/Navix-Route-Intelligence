import type { Indicator, PersonalBaseline } from './driver-baseline';
import { LONG_DAY_MINUTES } from './driver-performance';
import {
  LOAD_ORDER_KM,
  REPEATED_FAILURES,
  recommendKaizen,
  type KaizenInput,
} from './kaizen-recommendation';

function indicador(over: Partial<Indicator> = {}): Indicator {
  return { current: 10, baseline: 10, trend: 'stable', sample: 5, ...over };
}

function baseline(over: Partial<PersonalBaseline> = {}): PersonalBaseline {
  return {
    day: '2026-08-08',
    delivered: indicador(),
    successRate: indicador({ current: 1, baseline: 1 }),
    onTimeRate: { ...indicador({ current: 1, baseline: 1 }), informative: true },
    activeMinutes: { ...indicador({ current: 200, baseline: 200 }), informative: true },
    ...over,
  };
}

function entrada(over: Partial<KaizenInput> = {}): KaizenInput {
  return {
    state: 'ok',
    delivered: 10,
    failed: 0,
    activeMinutes: 200,
    savedKm: null,
    plans: 0,
    baseline: baseline(),
    ...over,
  };
}

describe('recommendKaizen', () => {
  it('é determinística: a mesma entrada dá sempre a mesma saída', () => {
    const e = entrada({ failed: 3 });

    expect(recommendKaizen(e)).toEqual(recommendKaizen(e));
  });

  it('toda mensagem traz a evidência que a produziu', () => {
    const casos = [
      entrada({ activeMinutes: LONG_DAY_MINUTES + 1 }),
      entrada({ failed: 3 }),
      entrada({ plans: 1, savedKm: LOAD_ORDER_KM + 1 }),
      entrada(),
      entrada({ baseline: null }),
    ];

    for (const caso of casos) {
      const r = recommendKaizen(caso);
      // `none.no-work` é o único sem evidência, e não está nos casos acima.
      expect(r.evidence.length).toBeGreaterThan(0);
      for (const e of r.evidence) expect(typeof e.metric).toBe('string');
    }
  });

  describe('prioridade', () => {
    // Segurança vem antes de tudo: uma sugestão de eficiência logo a seguir a
    // um dia de doze horas é um pedido para repetir o dia de doze horas.
    it('descanso vence falhas e carga no mesmo dia', () => {
      const r = recommendKaizen(
        entrada({
          activeMinutes: LONG_DAY_MINUTES + 60,
          failed: 5,
          plans: 2,
          savedKm: 40,
        }),
      );

      expect(r.category).toBe('rest');
      expect(r.code).toBe('rest.long-day');
    });

    it('falhas vencem organização da carga', () => {
      const r = recommendKaizen(entrada({ failed: 2, plans: 2, savedKm: 40 }));

      expect(r.category).toBe('delivery-failures');
    });

    it('há sempre no máximo uma recomendação', () => {
      const r = recommendKaizen(entrada({ failed: 4, plans: 3, savedKm: 90 }));

      expect(Object.keys(r)).toEqual(['code', 'category', 'evidence', 'action']);
    });
  });

  describe('descanso', () => {
    it(`${LONG_DAY_MINUTES} minutos ou mais é dia longo`, () => {
      const r = recommendKaizen(entrada({ activeMinutes: LONG_DAY_MINUTES }));

      expect(r.code).toBe('rest.long-day');
      expect(r.action).toEqual({ kind: 'plan-shorter-day' });
      expect(r.evidence[0]).toEqual({ metric: 'activeMinutes', value: LONG_DAY_MINUTES });
    });

    it('um minuto abaixo do limiar não dispara', () => {
      const r = recommendKaizen(entrada({ activeMinutes: LONG_DAY_MINUTES - 1 }));

      expect(r.category).not.toBe('rest');
    });

    // A direção invertida da ADR-0118: `attention` no tempo ativo significa
    // dia mais longo do que o habitual.
    it('dia mais longo do que o habitual também é descanso', () => {
      const r = recommendKaizen(
        entrada({
          activeMinutes: 260,
          baseline: baseline({
            activeMinutes: {
              ...indicador({ current: 260, baseline: 180, trend: 'attention' }),
              informative: true,
            },
          }),
        }),
      );

      expect(r.code).toBe('rest.longer-than-usual');
      expect(r.evidence[0]).toEqual({ metric: 'activeMinutes', value: 260, baseline: 180 });
    });

    it('sem minutos conhecidos, não se sugere descanso por palpite', () => {
      const r = recommendKaizen(entrada({ activeMinutes: null }));

      expect(r.category).not.toBe('rest');
    });
  });

  describe('falhas de entrega', () => {
    it('uma falha isolada é tratada como isolada', () => {
      const r = recommendKaizen(entrada({ failed: 1 }));

      expect(r.code).toBe('failures.first');
      expect(r.action).toEqual({ kind: 'review-failed-deliveries', count: 1 });
    });

    it(`${REPEATED_FAILURES} falhas já é padrão`, () => {
      const r = recommendKaizen(entrada({ failed: REPEATED_FAILURES }));

      expect(r.code).toBe('failures.repeated');
    });

    it('uma falha com taxa de sucesso em queda também é padrão', () => {
      const r = recommendKaizen(
        entrada({
          failed: 1,
          baseline: baseline({
            successRate: indicador({ current: 0.5, baseline: 0.95, trend: 'attention' }),
          }),
        }),
      );

      expect(r.code).toBe('failures.repeated');
      expect(r.evidence.map((e) => e.metric)).toContain('successRate');
    });

    it('sem falhas, a regra não dispara', () => {
      expect(recommendKaizen(entrada({ failed: 0 })).category).not.toBe('delivery-failures');
    });
  });

  describe('organização da carga', () => {
    it('poupança relevante sugere carregar na ordem da rota', () => {
      const r = recommendKaizen(entrada({ plans: 1, savedKm: LOAD_ORDER_KM }));

      expect(r.code).toBe('load.follow-suggested-order');
      expect(r.action).toEqual({ kind: 'load-in-route-order' });
    });

    it('poupança pequena não paga o incómodo de reorganizar', () => {
      const r = recommendKaizen(entrada({ plans: 1, savedKm: LOAD_ORDER_KM - 0.1 }));

      expect(r.category).toBeNull();
    });

    it('sem plano no dia, não há ordem sugerida a seguir', () => {
      expect(recommendKaizen(entrada({ plans: 0, savedKm: 50 })).category).toBeNull();
    });
  });

  describe('quando não há o que recomendar', () => {
    it('dia bom e histórico suficiente: reconhecimento neutro, sem ação', () => {
      const r = recommendKaizen(entrada());

      expect(r.code).toBe('none.acknowledge');
      expect(r.action).toBeNull();
    });

    it('sem histórico, pede-se mais histórico em vez de inventar conselho', () => {
      const r = recommendKaizen(
        entrada({
          baseline: baseline({ delivered: indicador({ trend: 'building-history', sample: 1 }) }),
        }),
      );

      expect(r.code).toBe('none.building-history');
      expect(r.evidence[0]).toEqual({ metric: 'sample', value: 1 });
      expect(r.action).toBeNull();
    });

    it('dia sem trabalho não gera recomendação nem cobrança', () => {
      const r = recommendKaizen(entrada({ state: 'no-work', delivered: 0 }));

      expect(r.code).toBe('none.no-work');
      expect(r.action).toBeNull();
    });

    it('projeção pendente não vira conselho sobre um dia que não se leu', () => {
      expect(recommendKaizen(entrada({ state: 'pending' })).code).toBe('none.no-work');
    });
  });

  describe('o que o motor nunca produz', () => {
    // Não é validação no fim: é a ausência de códigos que digam isto. Este
    // teste guarda a ausência.
    it('nenhum código sugere velocidade, cortar pausas ou esticar a jornada', () => {
      const combinacoes: KaizenInput[] = [];
      for (const failed of [0, 1, 3]) {
        for (const activeMinutes of [null, 60, 200, LONG_DAY_MINUTES + 100]) {
          for (const savedKm of [null, 1, 50]) {
            combinacoes.push(entrada({ failed, activeMinutes, savedKm, plans: savedKm ? 2 : 0 }));
          }
        }
      }

      const proibido = /faster|speed|hurry|skip.*break|longer.*day|more.*volume/i;
      for (const caso of combinacoes) {
        const r = recommendKaizen(caso);
        expect(r.code).not.toMatch(proibido);
        expect(JSON.stringify(r.action)).not.toMatch(proibido);
      }
    });

    it('toda ação é de preparação, nunca de ritmo', () => {
      const acoes = new Set([
        'plan-shorter-day',
        'review-failed-deliveries',
        'load-in-route-order',
      ]);
      const casos = [
        entrada({ activeMinutes: LONG_DAY_MINUTES + 1 }),
        entrada({ failed: 2 }),
        entrada({ plans: 1, savedKm: 50 }),
      ];

      for (const caso of casos) {
        const acao = recommendKaizen(caso).action;
        expect(acoes.has(acao!.kind)).toBe(true);
      }
    });
  });
});
