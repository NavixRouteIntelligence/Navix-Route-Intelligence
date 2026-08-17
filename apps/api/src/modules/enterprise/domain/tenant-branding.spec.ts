import { ValidationError } from '../../../shared/kernel/domain-error';

import {
  applyBrandingPatch,
  tenantSlugFromHost,
  toTenantBrandingAdmin,
  tryNormalizeHost,
  validateCustomDomain,
  type TenantBrandingRecord,
} from './tenant-branding';

const current: TenantBrandingRecord = {
  tenantId: 'tenant-1',
  tenantName: 'Acme Logística',
  tenantSlug: 'acme-123456',
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  customDomain: null,
  customDomainVerifiedAt: null,
  updatedAt: null,
};

describe('tenant branding domain', () => {
  it('resolve somente um subdomínio de tenant e ignora hosts reservados', () => {
    expect(tenantSlugFromHost('acme-123456.navix.pt', 'navix.pt')).toBe('acme-123456');
    expect(tenantSlugFromHost('api.navix.pt', 'navix.pt')).toBeNull();
    expect(tenantSlugFromHost('a.b.navix.pt', 'navix.pt')).toBeNull();
    expect(tenantSlugFromHost('cliente.pt', 'navix.pt')).toBeNull();
  });

  it('não permite reivindicar o domínio da própria plataforma', () => {
    expect(() => validateCustomDomain('cliente.navix.pt', 'navix.pt')).toThrow(ValidationError);
  });

  it('tryNormalizeHost descarta host não público sem lançar, e tira a porta', () => {
    expect(tryNormalizeHost('App.Navix.PT.')).toBe('app.navix.pt');
    expect(tryNormalizeHost('acme.navix.pt:3000')).toBe('acme.navix.pt');
    for (const host of ['localhost', 'localhost:3000', '127.0.0.1', '[::1]:3000', '']) {
      expect(tryNormalizeHost(host)).toBeNull();
    }
  });

  it('cadastro de domínio próprio continua recusando host não público', () => {
    // O afrouxamento vale só para resolver a marca. Aceitar rótulo único aqui
    // deixaria um tenant reivindicar `localhost` ou um nome de intranet.
    for (const host of ['localhost', 'localhost:3000', '127.0.0.1']) {
      expect(() => validateCustomDomain(host, 'navix.pt')).toThrow(ValidationError);
    }
  });

  it('normaliza marca e cria desafio ao trocar o domínio', () => {
    const next = applyBrandingPatch(
      current,
      {
        displayName: '  Acme Express  ',
        logoUrl: 'https://cdn.example.com/logo.svg',
        primaryColor: '#aabbcc',
        accentColor: '#112233',
        customDomain: 'Entregas.Acme.PT',
      },
      'navix.pt',
    );

    expect(next).toMatchObject({
      displayName: 'Acme Express',
      logoUrl: 'https://cdn.example.com/logo.svg',
      primaryColor: '#AABBCC',
      accentColor: '#112233',
      customDomain: 'entregas.acme.pt',
      customDomainVerifiedAt: null,
    });
    expect(toTenantBrandingAdmin(next, 'token-1').domainVerification).toEqual({
      name: '_navix-verification.entregas.acme.pt',
      value: 'navix-verification=token-1',
    });
  });

  it('mantém a verificação quando o domínio não muda', () => {
    const verified = {
      ...current,
      customDomain: 'entregas.acme.pt',
      customDomainVerifiedAt: new Date('2026-08-02T12:00:00Z'),
    };
    const next = applyBrandingPatch(verified, { displayName: 'Acme Nova' }, 'navix.pt');

    expect(next.customDomainVerifiedAt).toEqual(verified.customDomainVerifiedAt);
    expect(toTenantBrandingAdmin(next).customDomainStatus).toBe('verified');
  });

  it('rejeita logo sem HTTPS e cor fora de #RRGGBB', () => {
    expect(() =>
      applyBrandingPatch(current, { logoUrl: 'http://example.com/logo.svg' }, 'navix.pt'),
    ).toThrow('HTTPS');
    expect(() => applyBrandingPatch(current, { primaryColor: 'red' }, 'navix.pt')).toThrow(
      '#RRGGBB',
    );
  });
});
