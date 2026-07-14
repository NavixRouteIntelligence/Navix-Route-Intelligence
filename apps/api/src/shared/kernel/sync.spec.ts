import { ValidationError } from './domain-error';
import { buildSyncMeta, decodeCursor, encodeCursor, normalizeSync } from './sync';

describe('sync (cursor de keyset)', () => {
  const cursor = { updatedAt: new Date('2026-07-13T10:00:00.000Z'), id: 'abc-123' };

  it('faz round-trip do cursor opaco', () => {
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded.id).toBe(cursor.id);
    expect(decoded.updatedAt.toISOString()).toBe(cursor.updatedAt.toISOString());
  });

  it('rejeita cursor malformado', () => {
    expect(() => decodeCursor('not-base64-json')).toThrow(ValidationError);
    expect(() => decodeCursor(Buffer.from('{"t":123}').toString('base64url'))).toThrow(
      ValidationError,
    );
    expect(() =>
      decodeCursor(Buffer.from('{"t":"nope","i":"x"}').toString('base64url')),
    ).toThrow(ValidationError);
  });
});

describe('normalizeSync', () => {
  it('usa a marca d’água quando não há cursor', () => {
    const n = normalizeSync({ updatedSince: '2026-07-13T10:00:00.000Z' });
    expect(n.since?.toISOString()).toBe('2026-07-13T10:00:00.000Z');
    expect(n.cursor).toBeUndefined();
  });

  it('cursor tem precedência sobre updatedSince', () => {
    const c = encodeCursor({ updatedAt: new Date('2026-07-13T09:00:00.000Z'), id: 'x' });
    const n = normalizeSync({ updatedSince: '2026-07-13T10:00:00.000Z', cursor: c });
    expect(n.cursor?.id).toBe('x');
    expect(n.since).toBeUndefined();
  });

  it('sem parâmetros é sync completo inicial (sem since nem cursor)', () => {
    const n = normalizeSync({});
    expect(n.since).toBeUndefined();
    expect(n.cursor).toBeUndefined();
    expect(n.limit).toBe(100);
  });

  it('limita o limit a [1, 500] com default 100', () => {
    expect(normalizeSync({ limit: 0 }).limit).toBe(100);
    expect(normalizeSync({ limit: 5000 }).limit).toBe(500);
    expect(normalizeSync({ limit: 42 }).limit).toBe(42);
  });

  it('rejeita updatedSince inválido', () => {
    expect(() => normalizeSync({ updatedSince: 'ontem' })).toThrow(ValidationError);
  });
});

describe('buildSyncMeta', () => {
  const last = { updatedAt: new Date('2026-07-13T10:00:00.000Z'), id: 'z' };

  it('emite nextCursor apenas quando há mais páginas', () => {
    const withMore = buildSyncMeta(last, 100, true);
    expect(withMore.hasMore).toBe(true);
    expect(withMore.nextCursor).toBe(encodeCursor(last));

    const caughtUp = buildSyncMeta(last, 100, false);
    expect(caughtUp.hasMore).toBe(false);
    expect(caughtUp.nextCursor).toBeNull();
  });

  it('nextCursor é null quando a página vem vazia', () => {
    expect(buildSyncMeta(null, 100, false).nextCursor).toBeNull();
  });
});
