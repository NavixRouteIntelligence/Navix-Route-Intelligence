import type { DriverDayRow } from '../driver-performance';

/** Read model diário por motorista (ADR-0097). Escopado por tenant (RLS). */
export interface DriverKpiRepositoryPort {
  /**
   * Recalcula o dia de **todos** os motoristas do tenant a partir do OLTP.
   *
   * Recomputação, e não incremento, pela mesma razão da ADR-0092: um evento
   * reprocessado duplicaria a contagem sem ninguém perceber.
   */
  rebuildDay(tenantId: string, day: string): Promise<void>;

  /** Linhas de um motorista no período, em ordem cronológica. */
  range(tenantId: string, driverId: string, from: string, to: string): Promise<DriverDayRow[]>;

  /**
   * Ficha do login autenticado (ADR-0086). `null` para o motorista autônomo,
   * que não tem ficha.
   *
   * Resolvido aqui, por SQL, e não pelo `FleetModule`: o Analytics não importa
   * módulo de negócio nenhum (ADR-0092), e esta é a mesma leitura direta das
   * tabelas de origem que a projeção já faz.
   */
  driverIdForUser(tenantId: string, userId: string): Promise<string | null>;
}

export const DRIVER_KPI_REPOSITORY = Symbol('DRIVER_KPI_REPOSITORY');
