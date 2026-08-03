import type { PageParams } from '../../../../shared/kernel/pagination';
import type { Driver } from '../driver';
import type { PagedResult } from './vehicle-repository.port';

/** Ficha reduzida ao que outro contexto pode ver dela (ADR-0101). */
export interface RosterDriver {
  id: string;
  name: string;
}

/** Port do repositório de motoristas. Toda operação é escopada por `tenantId`. */
export interface DriverRepositoryPort {
  save(driver: Driver): Promise<void>;
  findById(tenantId: string, id: string): Promise<Driver | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<Driver>>;
  existsByLicense(tenantId: string, licenseNumber: string, excludeId?: string): Promise<boolean>;
  /** Já há ficha ligada a este login neste tenant? (índice único — ADR-0085). */
  existsByUser(tenantId: string, userId: string): Promise<boolean>;
  /** Login ligado a esta ficha, se houver (ADR-0086). */
  findUserIdById(tenantId: string, driverId: string): Promise<string | null>;
  /** Fichas destes logins, em uma consulta só — evita N+1 na visão de frota. */
  findIdsByUserIds(tenantId: string, userIds: string[]): Promise<Map<string, string>>;
  /**
   * Fichas **ativas** do tenant, em ordem estável — quem pode receber entrega
   * numa distribuição e quem aparece no painel dela (ADR-0101). Devolve id e
   * nome, e nada mais: o nome é o que identifica a pessoa na tela; CNH,
   * habilidades e o resto da ficha não têm o que fazer fora do Fleet.
   */
  findActive(tenantId: string): Promise<RosterDriver[]>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const DRIVER_REPOSITORY = Symbol('DRIVER_REPOSITORY');
