import type { PageParams } from '../../../../shared/kernel/pagination';
import type { Driver } from '../driver';
import type { PagedResult } from './vehicle-repository.port';

/** Port do repositório de motoristas. Toda operação é escopada por `tenantId`. */
export interface DriverRepositoryPort {
  save(driver: Driver): Promise<void>;
  findById(tenantId: string, id: string): Promise<Driver | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<Driver>>;
  existsByLicense(tenantId: string, licenseNumber: string, excludeId?: string): Promise<boolean>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const DRIVER_REPOSITORY = Symbol('DRIVER_REPOSITORY');
