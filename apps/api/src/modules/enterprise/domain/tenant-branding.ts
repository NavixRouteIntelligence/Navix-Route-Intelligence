import { createHmac } from 'node:crypto';

import type {
  TenantBranding,
  TenantBrandingAdmin,
  UpdateTenantBrandingRequest,
} from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';

export const DEFAULT_PRIMARY_COLOR = '#6D4AFF';
export const DEFAULT_ACCENT_COLOR = '#20BFA9';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'www', 'track', 'status']);

export interface TenantBrandingRecord {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Normaliza um host (minúsculo, sem ponto final, sem porta) ou devolve `null`
 * se ele não for um hostname público válido.
 *
 * Existe separado de `normalizeHost` porque os dois chamadores querem coisas
 * opostas. Resolver a marca de um host que não é público — `localhost`, um IP,
 * o que um proxy mal configurado mandar — é uma **resposta vazia legítima**:
 * aquele host simplesmente não tem marca. Já cadastrar um domínio próprio é
 * entrada de administrador e precisa recusar.
 */
export function tryNormalizeHost(value: string): string | null {
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || raw.includes('://') || raw.includes('/') || raw.includes('@')) return null;
  const hostname = raw.includes(':') ? raw.slice(0, raw.lastIndexOf(':')) : raw;
  return HOSTNAME.test(hostname) ? hostname : null;
}

export function normalizeHost(value: string): string {
  const hostname = tryNormalizeHost(value);
  if (!hostname) throw new ValidationError('Host inválido.');
  return hostname;
}

export function tenantSlugFromHost(host: string, baseDomain: string): string | null {
  const normalizedHost = normalizeHost(host);
  const normalizedBase = normalizeHost(baseDomain);
  const suffix = `.${normalizedBase}`;
  if (!normalizedHost.endsWith(suffix)) return null;
  const slug = normalizedHost.slice(0, -suffix.length);
  if (!slug || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function validateCustomDomain(value: string, baseDomain: string): string {
  const domain = normalizeHost(value);
  const normalizedBase = normalizeHost(baseDomain);
  if (domain === normalizedBase || domain.endsWith(`.${normalizedBase}`)) {
    throw new ValidationError('Use o subdomínio da organização para domínios Navix.');
  }
  return domain;
}

function normalizeLogoUrl(value: string | null): string | null {
  if (value == null || value.trim() === '') return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ValidationError('URL do logo inválida.');
  }
  if (url.protocol !== 'https:') throw new ValidationError('O logo deve usar HTTPS.');
  return url.toString();
}

function normalizeColor(value: string, field: string): string {
  const color = value.trim().toUpperCase();
  if (!HEX_COLOR.test(color)) throw new ValidationError(`${field} deve usar #RRGGBB.`);
  return color;
}

export function applyBrandingPatch(
  current: TenantBrandingRecord,
  patch: UpdateTenantBrandingRequest,
  baseDomain: string,
): TenantBrandingRecord {
  const displayName =
    patch.displayName === undefined ? current.displayName : patch.displayName.trim();
  if (displayName !== null && (displayName.length < 2 || displayName.length > 80)) {
    throw new ValidationError('Nome da marca deve ter entre 2 e 80 caracteres.');
  }

  const customDomain =
    patch.customDomain === undefined
      ? current.customDomain
      : patch.customDomain == null || patch.customDomain.trim() === ''
        ? null
        : validateCustomDomain(patch.customDomain, baseDomain);
  const domainChanged = customDomain !== current.customDomain;

  return {
    ...current,
    displayName,
    logoUrl: patch.logoUrl === undefined ? current.logoUrl : normalizeLogoUrl(patch.logoUrl),
    primaryColor:
      patch.primaryColor === undefined
        ? current.primaryColor
        : normalizeColor(patch.primaryColor, 'Cor principal'),
    accentColor:
      patch.accentColor === undefined
        ? current.accentColor
        : normalizeColor(patch.accentColor, 'Cor de destaque'),
    customDomain,
    customDomainVerifiedAt: domainChanged ? null : current.customDomainVerifiedAt,
    updatedAt: new Date(),
  };
}

export function domainVerificationToken(tenantId: string, domain: string, secret: string): string {
  return createHmac('sha256', secret).update(`${tenantId}:${domain}`).digest('base64url');
}

export function toTenantBranding(record: TenantBrandingRecord): TenantBranding {
  return {
    tenantSlug: record.tenantSlug,
    displayName: record.displayName ?? record.tenantName,
    logoUrl: record.logoUrl,
    primaryColor: record.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    accentColor: record.accentColor ?? DEFAULT_ACCENT_COLOR,
    customDomain: record.customDomain,
    customDomainStatus: !record.customDomain
      ? 'not_configured'
      : record.customDomainVerifiedAt
        ? 'verified'
        : 'pending',
    // O port existe, mas nenhum adaptador de IdP é ativado nesta base.
    ssoProtocols: [],
  };
}

export function toTenantBrandingAdmin(
  record: TenantBrandingRecord,
  verificationToken?: string,
): TenantBrandingAdmin {
  const view = toTenantBranding(record);
  return {
    ...view,
    domainVerification:
      record.customDomain && !record.customDomainVerifiedAt && verificationToken
        ? {
            name: `_navix-verification.${record.customDomain}`,
            value: `navix-verification=${verificationToken}`,
          }
        : null,
  };
}
