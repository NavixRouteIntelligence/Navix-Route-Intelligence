/** Protocolo aceito pela futura integração de identidade corporativa. */
export type EnterpriseSsoProtocol = 'saml' | 'oidc';

export type CustomDomainStatus = 'not_configured' | 'pending' | 'verified';

/** Marca pública e segura, resolvida antes mesmo da autenticação. */
export interface TenantBranding {
  tenantSlug: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
  customDomainStatus: CustomDomainStatus;
  ssoProtocols: EnterpriseSsoProtocol[];
}

/** Instrução administrativa para provar a posse do domínio por DNS TXT. */
export interface DomainVerification {
  name: string;
  value: string;
}

export interface TenantBrandingAdmin extends TenantBranding {
  domainVerification: DomainVerification | null;
}

/** Patch da marca do tenant. `null` remove o valor opcional. */
export interface UpdateTenantBrandingRequest {
  displayName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  customDomain?: string | null;
}
