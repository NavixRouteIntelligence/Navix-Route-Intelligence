import type { DailyRawRow, DailySubject } from '../daily-subject';

/** Read model diário por **sujeito** (ADR-0097/0117). Escopado por tenant (RLS). */
export interface DriverKpiRepositoryPort {
  /**
   * Recalcula o dia de **todos** os sujeitos do tenant a partir do OLTP.
   *
   * Recomputação, e não incremento, pela mesma razão da ADR-0092: um evento
   * reprocessado duplicaria a contagem sem ninguém perceber. Apaga e reescreve
   * o dia, para que uma linha que deixou de ter origem também desapareça.
   */
  rebuildDay(tenantId: string, day: string): Promise<void>;

  /** Linhas cruas de um sujeito no período, em ordem cronológica. */
  range(tenantId: string, subject: DailySubject, from: string, to: string): Promise<DailyRawRow[]>;

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
