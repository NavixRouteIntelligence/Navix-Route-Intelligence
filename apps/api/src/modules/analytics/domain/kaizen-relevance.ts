import type { KaizenEvidence, KaizenRecommendation } from './kaizen-recommendation';

/**
 * Relevância da próxima sugestão, a partir do que já se disse a esta pessoa
 * (ADR-0121).
 *
 * ## O que isto nunca faz
 *
 * Não mede aderência, não pontua, não alimenta KPI nenhum. A única pergunta é
 * **vale a pena repetir isto hoje?** — e a resposta só olha para o histórico do
 * próprio utilizador. Não há entrada para o feedback de outra pessoa, pela
 * mesma razão de sempre: sem superfície não há uso indevido.
 */

export type FeedbackVerdict = 'useful' | 'not-applicable';

/** Motivos fechados. Texto livre não entra — ver a nota da migração. */
export type FeedbackReason = 'wrong-data' | 'already-done' | 'out-of-context' | 'other';

export interface KaizenFeedbackEntry {
  day: string;
  code: string;
  verdict: FeedbackVerdict;
  reason?: FeedbackReason | null;
}

/**
 * O que já foi mostrado, para não repetir sem motivo.
 *
 * Não fica gravado: o motor é determinístico (ADR-0119), e a recomendação de
 * ontem é **recalculada** a partir do read model. Guardá-la seria manter uma
 * cópia que pode divergir da regra que a produziu — e teria de ser escrita numa
 * leitura, que é o tipo de efeito colateral que torna um GET imprevisível.
 */
export interface ShownRecommendation {
  day: string;
  code: string;
  evidence: KaizenEvidence[];
}

/**
 * Dias durante os quais um «não se aplica» silencia aquele código.
 *
 * Duas semanas é longo o bastante para a pessoa notar que foi ouvida, e curto o
 * bastante para uma situação que mudou voltar a ser sugerida. Silenciar para
 * sempre transformaria uma resposta num veto permanente que ninguém se lembra
 * de ter dado.
 */
export const NOT_APPLICABLE_QUIET_DAYS = 14;

/**
 * Motivo que **não** silencia: quando o dado estava errado, o problema é do
 * dado. Calar a sugestão esconderia o defeito em vez de o corrigir, e a pessoa
 * deixaria de ver o assunto justamente enquanto ele continua errado.
 */
export const REASON_WITHOUT_QUIET: FeedbackReason = 'wrong-data';

export type SuppressionReason =
  'repeated-without-new-evidence' | 'marked-not-applicable' | 'hidden';

export interface RelevanceInput {
  recommendation: KaizenRecommendation;
  /** Recomendação mostrada no dia anterior de trabalho, se houve. */
  previous: ShownRecommendation | null;
  /** Feedback recente do próprio utilizador, do mais novo para o mais velho. */
  feedback: readonly KaizenFeedbackEntry[];
  /** O utilizador escolheu esconder as sugestões (mantendo os resultados). */
  hidden: boolean;
  /** Dia a que a recomendação se refere, para medir a distância do feedback. */
  day: string;
}

export interface RelevanceDecision {
  /** `null` quando a sugestão foi silenciada. Os resultados nunca são. */
  recommendation: KaizenRecommendation | null;
  suppressedBy: SuppressionReason | null;
}

/**
 * Decide se a recomendação de hoje aparece (ADR-0121).
 *
 * Três razões para silenciar, e nenhuma delas é castigo:
 *
 * 1. **Escondido pelo utilizador.** Escolha explícita, e vale sempre.
 * 2. **Repetida sem evidência nova.** Ver a mesma frase dois dias seguidos com
 *    os mesmos números ensina a fechar o resumo sem ler.
 * 3. **Marcada como «não se aplica»** nos últimos dias — exceto quando o motivo
 *    foi «dado incorreto», que é problema do dado e não da sugestão.
 *
 * Os `none.*` nunca são silenciados: são o próprio reconhecimento neutro, e
 * calá-los deixaria a tela sem explicação para a ausência de sugestão.
 */
export function decideRelevance(input: RelevanceInput): RelevanceDecision {
  const { recommendation } = input;

  if (recommendation.code.startsWith('none.')) {
    return { recommendation, suppressedBy: null };
  }

  if (input.hidden) return { recommendation: null, suppressedBy: 'hidden' };

  if (repetidaSemNovidade(recommendation, input.previous)) {
    return { recommendation: null, suppressedBy: 'repeated-without-new-evidence' };
  }

  if (silenciadaPorFeedback(recommendation.code, input.feedback, input.day)) {
    return { recommendation: null, suppressedBy: 'marked-not-applicable' };
  }

  return { recommendation, suppressedBy: null };
}

/**
 * Mesma recomendação e mesma evidência: nada mudou desde ontem.
 *
 * A comparação é sobre os **valores**, não sobre o código: um dia longo que
 * ficou mais longo ainda é evidência nova, e merece ser dito outra vez.
 */
function repetidaSemNovidade(
  atual: KaizenRecommendation,
  anterior: ShownRecommendation | null,
): boolean {
  if (!anterior || anterior.code !== atual.code) return false;
  return assinatura(atual.evidence) === assinatura(anterior.evidence);
}

function assinatura(evidence: readonly KaizenEvidence[]): string {
  return [...evidence]
    .map((e) => `${e.metric}=${e.value ?? '?'}|${e.baseline ?? '?'}`)
    .sort()
    .join(';');
}

function silenciadaPorFeedback(
  code: string,
  feedback: readonly KaizenFeedbackEntry[],
  day: string,
): boolean {
  const hoje = Date.parse(`${day}T00:00:00Z`);
  return feedback.some((f) => {
    if (f.code !== code || f.verdict !== 'not-applicable') return false;
    if (f.reason === REASON_WITHOUT_QUIET) return false;
    const dias = (hoje - Date.parse(`${f.day}T00:00:00Z`)) / 86_400_000;
    return dias >= 0 && dias <= NOT_APPLICABLE_QUIET_DAYS;
  });
}
