import type { KaizenInput, KaizenRecommendation } from '../kaizen-recommendation';

/**
 * Motor de recomendação Kaizen (ADR-0119), atrás de uma port.
 *
 * A implementação de hoje é determinística por regras. A port existe para que
 * uma futura — outro conjunto de regras, um modelo — entre sem tocar em quem
 * consome, e para que a troca seja uma decisão explícita e não uma dependência
 * que se infiltra. O contrato obriga a devolver **evidência**, o que já exclui
 * qualquer implementação que não consiga dizer por que recomendou.
 */
export interface KaizenAdvisorPort {
  recommend(input: KaizenInput): KaizenRecommendation;
}

export const KAIZEN_ADVISOR = Symbol('KAIZEN_ADVISOR');
