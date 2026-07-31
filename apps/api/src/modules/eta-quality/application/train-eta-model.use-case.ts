import { Inject, Injectable, Logger } from '@nestjs/common';

import { bucketsFor } from '../../intelligence/domain/cell-features';
import {
  evaluateCorrections,
  splitByTime,
  trainCorrections,
  type EtaModelEvaluation,
  type EtaTrainingSample,
} from '../../intelligence/domain/eta-correction';
import { StoreEtaModelUseCase } from '../../intelligence/application/store-eta-model.use-case';
import {
  ETA_OBSERVATION_REPOSITORY,
  type EtaObservationRepositoryPort,
} from '../domain/ports/eta-observation-repository.port';

/** Janela de treino. 90 dias acompanha a sazonalidade sem carregar o ano todo. */
const TRAIN_WINDOW_DAYS = 90;
const MAX_SAMPLES = 20_000;

export interface TrainEtaModelResult extends EtaModelEvaluation {
  /** Amostras usadas no treino (as mais antigas da janela). */
  trainSamples: number;
  /** Baldes que passaram da amostra mínima. */
  buckets: number;
  /** `true` quando o modelo foi promovido a produção. */
  published: boolean;
}

/**
 * Treina e **avalia** o modelo de correção do ETA (ADR-0090).
 *
 * Vive aqui, e não no Intelligence, porque é aqui que estão os rótulos
 * (`eta_observations`). O resultado é publicado no Intelligence, que serve o
 * modelo a quem prevê — a mesma divisão das features: quem mede empurra, quem
 * serve guarda.
 *
 * ## O portão
 *
 * Só publica se o modelo **bater a heurística em dados que ele não viu**. Um
 * modelo pior em produção é bem pior que nenhum modelo: a heurística ao menos
 * se explica, e o erro dela já está medido. Sem esse portão, "temos ML" viraria
 * uma regressão silenciosa de produto.
 */
@Injectable()
export class TrainEtaModelUseCase {
  private readonly logger = new Logger('TrainEtaModel');

  constructor(
    @Inject(ETA_OBSERVATION_REPOSITORY)
    private readonly observations: EtaObservationRepositoryPort,
    private readonly store: StoreEtaModelUseCase,
  ) {}

  async execute(tenantId: string): Promise<TrainEtaModelResult> {
    const since = new Date(Date.now() - TRAIN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.observations.trainingSamples(tenantId, since, MAX_SAMPLES);

    // Ordem cronológica: a divisão treino/teste é temporal (ver `splitByTime`).
    const samples: EtaTrainingSample[] = rows.map((r) => ({
      // Resíduo da heurística CRUA. Se um modelo já estava ativo, a previsão
      // medida veio corrigida — somar a correção de volta é o que impede o
      // modelo de corrigir a própria correção e entrar em deriva (ADR-0090).
      baselineErrorMinutes: r.errorMinutes + r.correctionMinutes,
      buckets: bucketsFor(r.predictedArrivalAt),
    }));

    const { train, test } = splitByTime(samples);
    const corrections = trainCorrections(train);
    const evaluation = evaluateCorrections(corrections, test);

    if (evaluation.accepted) {
      await this.store.execute(tenantId, corrections);
      this.logger.log(
        `Modelo publicado: MAE ${evaluation.baselineMae} → ${evaluation.modelMae} min (${evaluation.improvementPct}%).`,
      );
    } else {
      this.logger.log(
        `Modelo recusado (MAE ${evaluation.baselineMae} → ${evaluation.modelMae} min, ${evaluation.improvementPct}%): a heurística permanece.`,
      );
    }

    return {
      ...evaluation,
      trainSamples: train.length,
      buckets: corrections.length,
      published: evaluation.accepted,
    };
  }
}
