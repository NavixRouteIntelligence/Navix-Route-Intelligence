import type { KaizenRecommendation } from './kaizen-recommendation';
import {
  NOT_APPLICABLE_QUIET_DAYS,
  decideRelevance,
  type KaizenFeedbackEntry,
  type ShownRecommendation,
} from './kaizen-relevance';

const HOJE = '2026-08-09';

function rec(over: Partial<KaizenRecommendation> = {}): KaizenRecommendation {
  return {
    code: 'rest.long-day',
    category: 'rest',
    evidence: [{ metric: 'activeMinutes', value: 300 }],
    action: { kind: 'plan-shorter-day' },
    ...over,
  };
}

function mostrada(over: Partial<ShownRecommendation> = {}): ShownRecommendation {
  return {
    day: '2026-08-08',
    code: 'rest.long-day',
    evidence: [{ metric: 'activeMinutes', value: 300 }],
    ...over,
  };
}

function decidir(over: Partial<Parameters<typeof decideRelevance>[0]> = {}) {
  return decideRelevance({
    recommendation: rec(),
    previous: null,
    feedback: [],
    hidden: false,
    day: HOJE,
    ...over,
  });
}

describe('decideRelevance', () => {
  it('sem histórico nem preferência, a sugestão aparece', () => {
    expect(decidir()).toEqual({ recommendation: rec(), suppressedBy: null });
  });

  describe('não repetir sem evidência nova', () => {
    // Ver a mesma frase dois dias seguidos com os mesmos números ensina a
    // fechar o resumo sem ler.
    it('mesma recomendação e mesmos números: silenciada', () => {
      const r = decidir({ previous: mostrada() });

      expect(r.recommendation).toBeNull();
      expect(r.suppressedBy).toBe('repeated-without-new-evidence');
    });

    // Um dia longo que ficou mais longo é evidência nova, e merece ser dito.
    it('mesma recomendação com números diferentes: aparece', () => {
      const r = decidir({
        recommendation: rec({ evidence: [{ metric: 'activeMinutes', value: 420 }] }),
        previous: mostrada(),
      });

      expect(r.recommendation).not.toBeNull();
    });

    it('recomendação diferente: aparece', () => {
      const r = decidir({ previous: mostrada({ code: 'failures.repeated' }) });

      expect(r.recommendation).not.toBeNull();
    });

    it('a ordem da evidência não conta como novidade', () => {
      const duas = [
        { metric: 'savedKm', value: 12 },
        { metric: 'plans', value: 2 },
      ];
      const r = decidir({
        recommendation: rec({ code: 'load.follow-suggested-order', evidence: [...duas].reverse() }),
        previous: mostrada({ code: 'load.follow-suggested-order', evidence: duas }),
      });

      expect(r.suppressedBy).toBe('repeated-without-new-evidence');
    });
  });

  describe('«não se aplica» silencia por um tempo', () => {
    function naoSeAplica(over: Partial<KaizenFeedbackEntry> = {}): KaizenFeedbackEntry {
      return { day: '2026-08-08', code: 'rest.long-day', verdict: 'not-applicable', ...over };
    }

    it('silencia o mesmo código nos dias seguintes', () => {
      const r = decidir({ feedback: [naoSeAplica()] });

      expect(r.suppressedBy).toBe('marked-not-applicable');
    });

    it('não silencia outro código', () => {
      const r = decidir({ feedback: [naoSeAplica({ code: 'failures.repeated' })] });

      expect(r.recommendation).not.toBeNull();
    });

    it('«foi útil» não silencia nada', () => {
      const r = decidir({ feedback: [naoSeAplica({ verdict: 'useful' })] });

      expect(r.recommendation).not.toBeNull();
    });

    // O silêncio expira: uma situação que mudou volta a ser sugerida, e um
    // «não se aplica» não vira veto permanente que ninguém se lembra de ter dado.
    it(`expira depois de ${NOT_APPLICABLE_QUIET_DAYS} dias`, () => {
      const antigo = new Date(
        Date.parse(`${HOJE}T00:00:00Z`) - (NOT_APPLICABLE_QUIET_DAYS + 1) * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);

      expect(decidir({ feedback: [naoSeAplica({ day: antigo })] }).recommendation).not.toBeNull();
    });

    it('no último dia da janela ainda silencia', () => {
      const limite = new Date(
        Date.parse(`${HOJE}T00:00:00Z`) - NOT_APPLICABLE_QUIET_DAYS * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);

      expect(decidir({ feedback: [naoSeAplica({ day: limite })] }).suppressedBy).toBe(
        'marked-not-applicable',
      );
    });

    // Quando o dado estava errado, o problema é do dado. Calar a sugestão
    // esconderia o defeito enquanto ele continua lá.
    it('«dado incorreto» não silencia: o problema é do dado', () => {
      const r = decidir({ feedback: [naoSeAplica({ reason: 'wrong-data' })] });

      expect(r.recommendation).not.toBeNull();
    });

    it('os outros motivos silenciam', () => {
      for (const reason of ['already-done', 'out-of-context', 'other'] as const) {
        expect(decidir({ feedback: [naoSeAplica({ reason })] }).suppressedBy).toBe(
          'marked-not-applicable',
        );
      }
    });
  });

  describe('esconder sugestões', () => {
    it('escondido silencia qualquer sugestão', () => {
      const r = decidir({ hidden: true });

      expect(r.recommendation).toBeNull();
      expect(r.suppressedBy).toBe('hidden');
    });

    // Esconder é sobre conselho, não sobre resultado: o `none.*` é o
    // reconhecimento neutro, e calá-lo deixaria a tela sem explicação.
    it('mesmo escondido, o reconhecimento neutro continua', () => {
      const r = decidir({ hidden: true, recommendation: rec({ code: 'none.acknowledge' }) });

      expect(r.recommendation).not.toBeNull();
    });

    it('e o «a construir histórico» também', () => {
      const r = decidir({ hidden: true, recommendation: rec({ code: 'none.building-history' }) });

      expect(r.suppressedBy).toBeNull();
    });
  });

  describe('o que a regra nunca faz', () => {
    // O feedback só influencia a próxima sugestão. Não há entrada para número
    // nenhum de desempenho, e a saída é só a recomendação.
    it('a decisão só devolve a recomendação e o motivo do silêncio', () => {
      expect(Object.keys(decidir())).toEqual(['recommendation', 'suppressedBy']);
    });

    it('é pura: a mesma entrada dá sempre a mesma saída', () => {
      const entrada = {
        recommendation: rec(),
        previous: mostrada(),
        feedback: [],
        hidden: false,
        day: HOJE,
      };

      expect(decideRelevance(entrada)).toEqual(decideRelevance(entrada));
    });
  });
});
