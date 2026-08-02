import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { TenantBrandingRepositoryPort } from '../../domain/ports/tenant-branding-repository.port';
import type { TenantBrandingRecord } from '../../domain/tenant-branding';

interface BrandingRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: Date | string | null;
  updated_at: Date | string | null;
}

const SELECT_BRANDING = `
  SELECT t.id AS tenant_id,
         t.name AS tenant_name,
         t.slug AS tenant_slug,
         b.display_name,
         b.logo_url,
         b.primary_color,
         b.accent_color,
         b.custom_domain,
         b.custom_domain_verified_at,
         b.updated_at
    FROM tenants t
    LEFT JOIN tenant_branding b ON b.tenant_id = t.id
`;

@Injectable()
export class TenantBrandingRepository implements TenantBrandingRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get manager(): EntityManager {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async findByTenant(tenantId: string): Promise<TenantBrandingRecord | null> {
    return this.one(`${SELECT_BRANDING} WHERE t.id = $1 LIMIT 1`, [tenantId]);
  }

  async findBySlug(slug: string): Promise<TenantBrandingRecord | null> {
    return this.one(`${SELECT_BRANDING} WHERE lower(t.slug) = lower($1) LIMIT 1`, [slug]);
  }

  async findByVerifiedDomain(domain: string): Promise<TenantBrandingRecord | null> {
    return this.one(
      `${SELECT_BRANDING}
       WHERE lower(b.custom_domain) = lower($1)
         AND b.custom_domain_verified_at IS NOT NULL
       LIMIT 1`,
      [domain],
    );
  }

  async save(record: TenantBrandingRecord): Promise<void> {
    await this.manager.query(
      `INSERT INTO tenant_branding (
         tenant_id, display_name, logo_url, primary_color, accent_color,
         custom_domain, custom_domain_verified_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         logo_url = EXCLUDED.logo_url,
         primary_color = EXCLUDED.primary_color,
         accent_color = EXCLUDED.accent_color,
         custom_domain = EXCLUDED.custom_domain,
         custom_domain_verified_at = EXCLUDED.custom_domain_verified_at,
         updated_at = EXCLUDED.updated_at`,
      [
        record.tenantId,
        record.displayName,
        record.logoUrl,
        record.primaryColor,
        record.accentColor,
        record.customDomain,
        record.customDomainVerifiedAt,
        record.updatedAt ?? new Date(),
      ],
    );
  }

  async markDomainVerified(tenantId: string, domain: string, at: Date): Promise<boolean> {
    const rows = (await this.manager.query(
      `UPDATE tenant_branding
          SET custom_domain_verified_at = $3, updated_at = $3
        WHERE tenant_id = $1 AND lower(custom_domain) = lower($2)
        RETURNING tenant_id`,
      [tenantId, domain, at],
    )) as Array<{ tenant_id: string }>;
    return rows.length === 1;
  }

  private async one(sql: string, params: unknown[]): Promise<TenantBrandingRecord | null> {
    const rows = (await this.manager.query(sql, params)) as BrandingRow[];
    const row = rows[0];
    if (!row) return null;
    return {
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      displayName: row.display_name,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
      customDomain: row.custom_domain,
      customDomainVerifiedAt: row.custom_domain_verified_at
        ? new Date(row.custom_domain_verified_at)
        : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }
}
