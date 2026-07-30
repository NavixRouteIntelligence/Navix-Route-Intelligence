import type { CellFeature, ServiceTimeSample } from '../cell-features';

/**
 * Armazenamento das features materializadas (ADR-0089). Tudo escopado por
 * tenant (RLS).
 */
export interface CellFeatureRepositoryPort {
  /**
   * Amostras cruas de tempo **medido** de uma célula na janela. Só `derived`:
   * o corpus em quarentena não entra na feature (ADR-0088).
   */
  samplesForCell(tenantId: string, cell: string, since: Date): Promise<ServiceTimeSample[]>;

  /**
   * Substitui **todos** os baldes de uma célula pelo conjunto recalculado.
   * Substituição, e não upsert linha a linha: um balde que deixou de ter
   * amostra suficiente (a janela deslizou) precisa desaparecer, e um upsell
   * parcial o deixaria para trás, congelado.
   */
  replaceCell(tenantId: string, cell: string, features: CellFeature[]): Promise<void>;

  /** Features de várias células numa consulta só — uma por parada da rota. */
  findByCells(tenantId: string, cells: string[]): Promise<CellFeature[]>;
}

export const CELL_FEATURE_REPOSITORY = Symbol('CELL_FEATURE_REPOSITORY');
