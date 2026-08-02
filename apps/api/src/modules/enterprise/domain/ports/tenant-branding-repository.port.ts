import type { TenantBrandingRecord } from '../tenant-branding';

export interface TenantBrandingRepositoryPort {
  findByTenant(tenantId: string): Promise<TenantBrandingRecord | null>;
  findBySlug(slug: string): Promise<TenantBrandingRecord | null>;
  findByVerifiedDomain(domain: string): Promise<TenantBrandingRecord | null>;
  save(record: TenantBrandingRecord): Promise<void>;
  markDomainVerified(tenantId: string, domain: string, at: Date): Promise<boolean>;
}

export const TENANT_BRANDING_REPOSITORY = Symbol('TENANT_BRANDING_REPOSITORY');
