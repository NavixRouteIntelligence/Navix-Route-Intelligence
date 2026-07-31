import type { EtaCorrection } from '../eta-correction';

/** Armazenamento dos parâmetros do modelo (ADR-0090). Escopado por tenant (RLS). */
export interface EtaCorrectionRepositoryPort {
  findAll(tenantId: string): Promise<EtaCorrection[]>;
  /**
   * Substitui o modelo inteiro do tenant. Substituição, e não upsert: um balde
   * que deixou de ter amostra suficiente precisa desaparecer, e um upsert
   * parcial o deixaria vivo com um parâmetro velho.
   */
  replace(tenantId: string, corrections: EtaCorrection[], trainedAt: Date): Promise<void>;
}

export const ETA_CORRECTION_REPOSITORY = Symbol('ETA_CORRECTION_REPOSITORY');
