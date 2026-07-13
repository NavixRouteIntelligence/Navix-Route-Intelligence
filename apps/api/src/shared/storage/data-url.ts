import { ValidationError } from '../kernel/domain-error';

export interface DecodedDataUrl {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

const DATA_URL_RE = /^data:([^;,]+)?((?:;[^,]*)*),(.*)$/s;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** É uma data URL (`data:...`)? Se não, assume-se que já é uma URL de storage. */
export function isDataUrl(value: string): boolean {
  return value.startsWith('data:');
}

/** Decodifica uma data URL em bytes + tipo + extensão (para offload no storage). */
export function decodeDataUrl(value: string): DecodedDataUrl {
  const match = DATA_URL_RE.exec(value);
  if (!match) throw new ValidationError('Data URL inválida.');

  const contentType = (match[1] || 'application/octet-stream').trim().toLowerCase();
  const params = match[2] ?? '';
  const payload = match[3] ?? '';
  const isBase64 = /;base64/i.test(params);

  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  const extension = EXTENSION_BY_TYPE[contentType] ?? 'bin';

  return { buffer, contentType, extension };
}
