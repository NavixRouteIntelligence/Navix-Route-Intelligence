import type { DriverPosition } from '../driver-position';

/**
 * Porta de persistência de posições. A implementação é escopada por tenant
 * (RLS). Preparada para volume de séries temporais (TimescaleDB — ver migração).
 */
export interface PositionRepositoryPort {
  /** Grava uma nova posição (append-only). */
  save(position: DriverPosition): Promise<void>;
  /** Última posição de um motorista específico. */
  findLatestForDriver(tenantId: string, driverId: string): Promise<DriverPosition | null>;
  /** Última posição de cada motorista do tenant (visão de frota). */
  findLatestPerDriver(tenantId: string): Promise<DriverPosition[]>;
  /** Histórico recente de um motorista, do mais novo ao mais antigo. */
  findHistory(tenantId: string, driverId: string, limit: number): Promise<DriverPosition[]>;
}

export const POSITION_REPOSITORY = Symbol('POSITION_REPOSITORY');
