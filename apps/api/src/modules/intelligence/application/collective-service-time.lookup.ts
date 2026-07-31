import { Inject, Injectable } from '@nestjs/common';

import { resolveFeature } from '../domain/cell-features';
import { locationCell } from '../domain/collective-insight';
import {
  CELL_FEATURE_REPOSITORY,
  type CellFeatureRepositoryPort,
} from '../domain/ports/cell-feature-repository.port';

export interface ServiceTimePoint {
  latitude: number;
  longitude: number;
}

/**
 * API pública do Intelligence para o **tempo de serviço típico** por local, a
 * partir das observações coletivas (ADR-0031/0065). Exposta para outros módulos
 * (ex.: Optimizer) sem revelar o repositório/agregação internos.
 */
export interface CollectiveServiceTimeLookupPort {
  /**
   * Tempo de serviço típico (min) de cada ponto, na ordem informada. `null`
   * quando não há amostra suficiente (< MIN_SAMPLE) — o consumidor cai no seu
   * próprio default. Consulta em lote (uma query para todos os pontos).
   */
  typicalServiceMinutes(
    tenantId: string,
    points: ServiceTimePoint[],
    at?: Date,
  ): Promise<(number | null)[]>;
}

export const COLLECTIVE_SERVICE_TIMES = Symbol('COLLECTIVE_SERVICE_TIMES');

@Injectable()
export class CollectiveServiceTimeLookup implements CollectiveServiceTimeLookupPort {
  constructor(
    @Inject(CELL_FEATURE_REPOSITORY)
    private readonly features: CellFeatureRepositoryPort,
  ) {}

  /**
   * Lê as features **materializadas** (ADR-0089) em vez de agregar as
   * observações cruas a cada chamada: uma busca por chave, e não até 2000
   * linhas medianizadas por consulta — o que fazia a leitura piorar à medida
   * que o histórico melhorava.
   *
   * `at` escolhe o contexto temporal; sem ele, o balde global da célula. O
   * otimizador ainda não informa o instante de cada parada, então hoje cai no
   * global — e passa a ganhar o recorte por hora assim que informar, sem
   * mudança aqui.
   */
  async typicalServiceMinutes(
    tenantId: string,
    points: ServiceTimePoint[],
    at: Date = new Date(),
  ): Promise<(number | null)[]> {
    if (points.length === 0) return [];

    const cells = points.map((p) => locationCell(p.latitude, p.longitude));
    const rows = await this.features.findByCells(tenantId, [...new Set(cells)]);

    const byCell = new Map<string, typeof rows>();
    for (const f of rows) {
      const list = byCell.get(f.cell);
      if (list) list.push(f);
      else byCell.set(f.cell, [f]);
    }

    return cells.map(
      (cell) => resolveFeature(byCell.get(cell) ?? [], at)?.serviceMinutesP50 ?? null,
    );
  }
}
