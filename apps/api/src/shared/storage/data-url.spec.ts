import { ValidationError } from '../kernel/domain-error';
import { decodeDataUrl, isDataUrl } from './data-url';

describe('data-url', () => {
  it('reconhece data URLs', () => {
    expect(isDataUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isDataUrl('https://cdn/x.png')).toBe(false);
  });

  it('decodifica base64 → buffer, contentType e extensão', () => {
    const value = `data:image/png;base64,${Buffer.from('hello').toString('base64')}`;
    const out = decodeDataUrl(value);
    expect(out.contentType).toBe('image/png');
    expect(out.extension).toBe('png');
    expect(out.buffer.toString('utf8')).toBe('hello');
  });

  it('mapeia jpeg → jpg', () => {
    expect(decodeDataUrl(`data:image/jpeg;base64,${Buffer.from('a').toString('base64')}`).extension).toBe('jpg');
  });

  it('rejeita SVG (vetor de XSS) e qualquer tipo não-rasterizado', () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`;
    expect(() => decodeDataUrl(svg)).toThrow(ValidationError);
    expect(() => decodeDataUrl(`data:application/pdf;base64,${Buffer.from('a').toString('base64')}`)).toThrow(ValidationError);
    expect(() => decodeDataUrl(`data:text/html;base64,${Buffer.from('a').toString('base64')}`)).toThrow(ValidationError);
  });

  it('rejeita valor que não é data URL', () => {
    expect(() => decodeDataUrl('https://cdn/x.png')).toThrow(ValidationError);
  });
});
