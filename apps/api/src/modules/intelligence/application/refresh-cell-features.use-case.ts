import { Inject, Injectable, Logger } from '@nestjs/common';

import { buildCellFeatures, FEATURE_WINDOW_DAYS } from '../domain/cell-features';
import {
  CELL_FEATURE_REPOSITORY,
  type CellFeatureRepositoryPort,
} from '../domain/ports/cell-feature-repository.port';

/**
 * Recalcula as features de **uma** célula (ADR-0089).
 *
 * O trabalho é feito na escrita, não na leitura, e é limitado a uma célula: as
 * observações de ~110 m numa janela de 90 dias são dezenas, não milhares. É
 * barato o bastante para rodar junto do registro da observação e dispensa
 * agendador — que o projeto não tem.
 */
@Injectable()
export class RefreshCellFeaturesUseCase {
  private readonly logger = new Logger('RefreshCellFeatures');

  constructor(
    @Inject(CELL_FEATURE_REPOSITORY)
    private readonly features: CellFeatureRepositoryPort,
  ) {}

  async execute(tenantId: string, cell: string): Promise<number> {
    const since = new Date(Date.now() - FEATURE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const samples = await this.features.samplesForCell(tenantId, cell, since);
    const built = buildCellFeatures(cell, samples);
    await this.features.replaceCell(tenantId, cell, built);
    return built.length;
  }

  /**
   * Versão que nunca falha o chamador: recalcular é manutenção do índice, e uma
   * feature desatualizada por um ciclo custa muito menos do que derrubar o
   * registro da observação que a originou.
   */
  async safeExecute(tenantId: string, cell: string): Promise<void> {
    try {
      await this.execute(tenantId, cell);
    } catch (err) {
      this.logger.warn(
        `Falha ao recalcular features da célula ${cell}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
