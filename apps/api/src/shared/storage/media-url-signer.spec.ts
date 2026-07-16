import { MediaUrlSigner, resolveMediaSecret } from './media-url-signer';

describe('MediaUrlSigner', () => {
  const signer = new MediaUrlSigner('s3cr3t', 900);
  const now = 1_000_000_000_000;

  it('assina e verifica uma chave dentro da validade', () => {
    const { exp, sig } = signer.sign('pod/t1/p1-photo.png', now);
    expect(signer.verify('pod/t1/p1-photo.png', exp, sig, now)).toBe(true);
  });

  it('rejeita assinatura expirada', () => {
    const { exp, sig } = signer.sign('k', now);
    expect(signer.verify('k', exp, sig, now + 901_000)).toBe(false);
  });

  it('rejeita assinatura adulterada ou chave trocada', () => {
    const { exp, sig } = signer.sign('k', now);
    expect(signer.verify('k', exp, `${sig}x`, now)).toBe(false);
    expect(signer.verify('outra-chave', exp, sig, now)).toBe(false);
  });

  it('rejeita exp inválido', () => {
    expect(signer.verify('k', Number.NaN, 'sig', now)).toBe(false);
  });
});

describe('resolveMediaSecret', () => {
  it('usa o segredo configurado quando presente', () => {
    expect(resolveMediaSecret('configurado')).toBe('configurado');
  });

  it('sem configuração, devolve um segredo estável no processo', () => {
    const a = resolveMediaSecret(undefined);
    const b = resolveMediaSecret('');
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
