import { Injectable } from '@nestjs/common';

import type { KaizenAdvisorPort } from '../../domain/ports/kaizen-advisor.port';
import {
  recommendKaizen,
  type KaizenInput,
  type KaizenRecommendation,
} from '../../domain/kaizen-recommendation';

/**
 * Adaptador determinístico por regras (ADR-0119).
 *
 * Não faz I/O e não tem estado: é a regra de domínio exposta pela port. Fica
 * aqui, e não no caso de uso, para que substituí-la seja trocar um provider —
 * e para que o caso de uso nunca precise de saber qual motor respondeu.
 */
@Injectable()
export class RuleBasedKaizenAdvisor implements KaizenAdvisorPort {
  recommend(input: KaizenInput): KaizenRecommendation {
    return recommendKaizen(input);
  }
}
