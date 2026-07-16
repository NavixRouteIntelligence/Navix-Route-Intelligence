import { ValidationError } from '../kernel/domain-error';

export interface DecodedDataUrl {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

const DATA_URL_RE = /^data:([^;,]+)?((?:;[^,]*)*),(.*)$/s;

/**
 * Tipos de imagem **rasterizada** aceitos (ADR-0039). `image/svg+xml` é
 * deliberadamente **excluído**: SVG pode conter script e, servido inline, é um
 * vetor de XSS armazenado. Só entram formatos que o navegador nunca executa.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
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

  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) {
    // Allowlist estrita: rejeita SVG e qualquer tipo não-rasterizado (anti-XSS).
    throw new ValidationError(`Tipo de mídia não permitido: ${contentType}.`);
  }

  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return { buffer, contentType, extension };
}
