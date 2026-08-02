import {
  canonicalHostname,
  isPrivateOrReservedAddress,
  isUnsafeWebhookHostname,
} from './webhook-url-security';

describe('webhook URL security', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
  ])('classifica rede privada ou reservada: %s', (address) => {
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it('aceita endereços públicos', () => {
    expect(isPrivateOrReservedAddress('93.184.216.34')).toBe(false);
    expect(isPrivateOrReservedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('normaliza IPv6 literal e bloqueia hosts locais ou IP literal', () => {
    expect(canonicalHostname('[::1]')).toBe('::1');
    expect(isUnsafeWebhookHostname('[::1]')).toBe(true);
    expect(isUnsafeWebhookHostname('service.internal')).toBe(true);
    expect(isUnsafeWebhookHostname('hooks.example.com')).toBe(false);
  });
});
