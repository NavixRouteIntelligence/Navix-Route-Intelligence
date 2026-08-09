import type { PersonalBaseline } from './driver-baseline';
import { LONG_DAY_MINUTES } from './driver-performance';

/**
 * Motor de recomendação Kaizen (ADR-0119): **uma** melhoria por dia, derivada
 * por regras determinísticas.
 *
 * ## O que sai daqui, e o que não
 *
 * Sai um **código** e a evidência que o justificou — nunca prosa. O texto vive
 * no `pt_PT` da app, sob o contrato de linguagem
 * (`docs/modules/kaizen-contrato-linguagem.md`), e mantê-lo fora daqui garante
 * duas coisas: que a mesma regra fala qualquer língua, e que a revisão do que
 * se pode dizer acontece onde as palavras estão, não espalhada em `if`s.
 *
 * A evidência é obrigatória e é composta de **métricas do próprio payload**.
 * É o que torna cada mensagem explicável: dada a recomendação, dá para apontar
 * os números que a produziram, sem consultar mais nada.
 *
 * ## O que este motor nunca recomenda
 *
 * Conduzir mais depressa, cortar pausas, esticar a jornada ou aumentar volume.
 * Não é uma regra de validação no fim — é a ausência de códigos que digam isso.
 * Não há `code` para "acelere" porque não existe caminho que o produza.
 */

/** Ordem de prioridade da T7.4. A primeira regra que dispara é a que vale. */
export type KaizenCategory =
  | 'rest'
  | 'delivery-failures'
  | 'address-preparation'
  | 'load-organization'
  | 'fuel-maintenance'
  | 'sustainability';

/**
 * Código da recomendação. É a chave de tradução e o identificador estável para
 * telemetria — mudar o texto não muda o código.
 */
export type KaizenCode =
  | 'rest.long-day'
  | 'rest.longer-than-usual'
  | 'failures.repeated'
  | 'failures.first'
  | 'load.follow-suggested-order'
  /** Nada a sugerir, e o dia correu bem. Reconhecimento neutro. */
  | 'none.acknowledge'
  /** Sem histórico suficiente para comparar seja o que for. */
  | 'none.building-history'
  /** Dia sem trabalho: não há o que recomendar, e isso não é uma falha. */
  | 'none.no-work';

/** Um número que sustenta a recomendação, com o nome da métrica de origem. */
export interface KaizenEvidence {
  metric: string;
  value: number | null;
  /** Referência pessoal, quando a regra comparou com o próprio histórico. */
  baseline?: number | null;
}

export interface KaizenRecommendation {
  code: KaizenCode;
  /** Ausente nos códigos `none.*`: não há categoria sem recomendação. */
  category: KaizenCategory | null;
  /** Métricas do payload que produziram esta mensagem. */
  evidence: KaizenEvidence[];
  /**
   * Ação executável, quando existe. `null` no reconhecimento neutro — sugerir
   * algo só para não vir vazio é como se aprende a ignorar o resumo.
   */
  action: KaizenAction | null;
}

/**
 * O que a pessoa pode fazer hoje. É sempre uma ação de **preparação**, nunca de
 * ritmo: preparar não tem como ser feito mais depressa ao volante.
 */
export type KaizenAction =
  | { kind: 'plan-shorter-day' }
  | { kind: 'review-failed-deliveries'; count: number }
  | { kind: 'load-in-route-order' };

/** Entrada do motor: o que a fotografia diária e o baseline já sabem. */
export interface KaizenInput {
  /** `no-work` e `pending` não geram recomendação. */
  state: 'ok' | 'incomplete' | 'no-work' | 'pending';
  delivered: number;
  failed: number;
  activeMinutes: number | null;
  /** Distância que a rota sugerida poupava face à ordem de origem. */
  savedKm: number | null;
  plans: number;
  baseline: PersonalBaseline | null;
}

/** Falhas a partir das quais deixa de ser um acaso e passa a valer olhar. */
export const REPEATED_FAILURES = 2;

/**
 * Quilómetros poupados a partir dos quais vale sugerir carregar na ordem da
 * rota. Abaixo disto, a diferença não paga o incómodo de reorganizar a carga.
 */
export const LOAD_ORDER_KM = 5;

/**
 * Escolhe **uma** melhoria para hoje (ADR-0119).
 *
 * Determinística e pura: mesma entrada, mesma saída, sem relógio nem base. A
 * ordem das regras é a prioridade da T7.4 — segurança primeiro, sempre —, e a
 * primeira que dispara encerra a decisão. Não há empilhamento: três conselhos
 * no mesmo ecrã são zero conselhos.
 */
export function recommendKaizen(input: KaizenInput): KaizenRecommendation {
  if (input.state === 'no-work' || input.state === 'pending') {
    return { code: 'none.no-work', category: null, evidence: [], action: null };
  }

  return descanso(input) ?? falhas(input) ?? organizacaoDaCarga(input) ?? semRecomendacao(input);
}

/**
 * 1. Segurança e descanso — antes de tudo o resto, mesmo quando há outra coisa
 *    a melhorar. Uma sugestão de eficiência a seguir a um dia de doze horas é
 *    um pedido para repetir o dia de doze horas.
 */
function descanso(input: KaizenInput): KaizenRecommendation | null {
  const minutos = input.activeMinutes;
  if (minutos === null) return null;

  if (minutos >= LONG_DAY_MINUTES) {
    return {
      code: 'rest.long-day',
      category: 'rest',
      evidence: [{ metric: 'activeMinutes', value: minutos }],
      action: { kind: 'plan-shorter-day' },
    };
  }

  // O baseline classifica dia mais longo do que o habitual como `attention`
  // (ADR-0118) — a direção do tempo ativo é invertida de propósito.
  const tempo = input.baseline?.activeMinutes;
  if (tempo?.trend === 'attention') {
    return {
      code: 'rest.longer-than-usual',
      category: 'rest',
      evidence: [{ metric: 'activeMinutes', value: tempo.current, baseline: tempo.baseline }],
      action: { kind: 'plan-shorter-day' },
    };
  }

  return null;
}

/** 2. Falhas de entrega — o que ficou por concluir, sem atribuir culpa. */
function falhas(input: KaizenInput): KaizenRecommendation | null {
  if (input.failed <= 0) return null;

  const repetido =
    input.failed >= REPEATED_FAILURES || input.baseline?.successRate.trend === 'attention';

  const evidence: KaizenEvidence[] = [{ metric: 'failed', value: input.failed }];
  const taxa = input.baseline?.successRate;
  if (repetido && taxa && taxa.current !== null) {
    evidence.push({ metric: 'successRate', value: taxa.current, baseline: taxa.baseline });
  }

  return {
    code: repetido ? 'failures.repeated' : 'failures.first',
    category: 'delivery-failures',
    evidence,
    action: { kind: 'review-failed-deliveries', count: input.failed },
  };
}

/**
 * 4. Organização da carga — carregar na ordem da rota sugerida.
 *
 * A evidência é a distância que a rota sugerida poupava face à ordem em que as
 * paragens foram enviadas (ADR-0116). Continua a ser um contrafactual, e é por
 * isso que a ação é **preparar a carga**, não "seguir a rota": o que se pede é
 * organização na véspera, não obediência ao volante.
 */
function organizacaoDaCarga(input: KaizenInput): KaizenRecommendation | null {
  if (input.plans <= 0 || input.savedKm === null || input.savedKm < LOAD_ORDER_KM) return null;

  return {
    code: 'load.follow-suggested-order',
    category: 'load-organization',
    evidence: [
      { metric: 'savedKm', value: input.savedKm },
      { metric: 'plans', value: input.plans },
    ],
    action: { kind: 'load-in-route-order' },
  };
}

/**
 * Nenhuma regra disparou.
 *
 * Sem histórico, diz-se isso; com histórico e nada a apontar, o dia é
 * reconhecido e **não** se inventa sugestão. Um conselho por obrigação é ruído,
 * e ruído diário é como se ensina alguém a fechar o resumo sem ler.
 */
function semRecomendacao(input: KaizenInput): KaizenRecommendation {
  const construindo = !input.baseline || input.baseline.delivered.trend === 'building-history';

  if (construindo) {
    return {
      code: 'none.building-history',
      category: null,
      evidence: [{ metric: 'sample', value: input.baseline?.delivered.sample ?? 0 }],
      action: null,
    };
  }

  return {
    code: 'none.acknowledge',
    category: null,
    evidence: [{ metric: 'delivered', value: input.delivered }],
    action: null,
  };
}
