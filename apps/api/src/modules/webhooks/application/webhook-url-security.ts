import { isIP } from 'node:net';

export function canonicalHostname(raw: string): string {
  return raw
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function isUnsafeWebhookHostname(raw: string): boolean {
  const host = canonicalHostname(raw);
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isIP(host) !== 0
  );
}

/** Nega redes não roteáveis para impedir SSRF, inclusive IPv4 mapeado em IPv6. */
export function isPrivateOrReservedAddress(raw: string): boolean {
  const address = canonicalHostname(raw);
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateOrReservedAddress(mapped[1]);

  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b, c] = parts;
    return (
      a === 0 ||
      a === 10 ||
      (a === 100 && b >= 64 && b <= 127) ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (isIP(address) === 6) {
    return (
      address === '::' ||
      address === '::1' ||
      address.startsWith('fc') ||
      address.startsWith('fd') ||
      /^fe[89ab]/.test(address) ||
      address.startsWith('ff') ||
      address.startsWith('2001:db8:')
    );
  }
  return true;
}
