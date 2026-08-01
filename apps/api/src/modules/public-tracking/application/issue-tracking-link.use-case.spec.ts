import type { AppConfigService } from '../../../shared/config/app-config.service';
import { ForbiddenError, NotFoundError } from '../../../shared/kernel/domain-error';
import type { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import type { DeliveryLookupPort } from '../../delivery/application/delivery-lookup.service';
import type { TrackingTokenRepositoryPort } from '../domain/ports/tracking-token-repository.port';
import { IssueTrackingLinkUseCase } from './issue-tracking-link.use-case';

function build(opts: { found?: unknown; existing?: string | null; premium?: boolean } = {}) {
  // `'found' in opts` e não `??`: o caso interessante é justamente `found: null`
  // (entrega de outro tenant, que a RLS esconde), que o `??` engoliria.
  const deliveries = {
    getPublicSnapshot: jest
      .fn()
      .mockResolvedValue('found' in opts ? opts.found : { status: 'pending' }),
  } as unknown as DeliveryLookupPort;

  const tokens: TrackingTokenRepositoryPort = {
    resolve: jest.fn(),
    findActiveByDelivery: jest.fn().mockResolvedValue(opts.existing ?? null),
    issue: jest.fn().mockResolvedValue(undefined),
  };

  const config = {
    publicTracking: { baseUrl: 'https://track.navix.pt' },
  } as unknown as AppConfigService;

  const features = {
    isEnabled: jest.fn().mockResolvedValue(opts.premium ?? true),
    require: jest.fn().mockImplementation(async () => {
      if (opts.premium === false) throw new ForbiddenError();
    }),
  } as unknown as FeatureAccessService;

  return {
    uc: new IssueTrackingLinkUseCase(deliveries, tokens, config, features),
    tokens,
    deliveries,
  };
}

describe('IssueTrackingLinkUseCase', () => {
  it('emite um token opaco e monta a URL pública', async () => {
    const { uc, tokens } = build();

    const res = await uc.execute('tenant-a', 'del-1');

    // 32 bytes em base64url = 43 chars, sem caracteres que precisem de escape.
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.url).toBe(`https://track.navix.pt/${res.token}`);
    expect(tokens.issue).toHaveBeenCalledWith(res.token, 'tenant-a', 'del-1');
  });

  // O token não pode derivar do id da entrega nem do tenant: derivar vazaria
  // estrutura interna e abriria enumeração.
  it('gera tokens diferentes para a mesma entrega em tenants distintos', async () => {
    const a = await build().uc.execute('tenant-a', 'del-1');
    const b = await build().uc.execute('tenant-b', 'del-1');

    expect(a.token).not.toEqual(b.token);
  });

  it('é idempotente: reemitir devolve o link vigente sem criar outro', async () => {
    const existing = 'z'.repeat(43);
    const { uc, tokens } = build({ existing });

    const res = await uc.execute('tenant-a', 'del-1');

    expect(res.token).toBe(existing);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  // A busca passa pela RLS: um id de outro tenant simplesmente não é achado.
  it('recusa emitir para entrega inexistente no tenant', async () => {
    const { uc, tokens } = build({ found: null });

    await expect(uc.execute('tenant-a', 'del-de-outro')).rejects.toBeInstanceOf(NotFoundError);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('plano básico não emite link nem consulta a entrega', async () => {
    const { uc, tokens, deliveries } = build({ premium: false });

    await expect(uc.execute('tenant-free', 'del-1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(deliveries.getPublicSnapshot).not.toHaveBeenCalled();
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
