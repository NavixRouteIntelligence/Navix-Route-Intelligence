import { createHmac } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { WebhookDispatcher } from './webhook-dispatcher';
import type { WebhookHttpClient } from './webhook-http.client';
import type { WebhookSecretCipher } from './webhook-secret-cipher';

const delivery = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  eventType: 'delivery.updated',
  payload: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
  attempts: 1,
  url: 'https://example.com/navix',
  encryptedSecret: 'ciphertext',
};

function build(item = delivery) {
  const updates: { query: string; params?: unknown[] }[] = [];
  const manager = {
    query: jest.fn(async (query: string, params?: unknown[]) => {
      updates.push({ query, params });
      return [];
    }),
  };
  const dataSource = {
    query: jest.fn().mockResolvedValueOnce([item]).mockResolvedValue([]),
    transaction: jest.fn(async (fn) => fn(manager)),
  } as unknown as DataSource;
  const cipher = {
    decrypt: jest.fn().mockReturnValue('whsec_test'),
  } as unknown as WebhookSecretCipher;
  const http = {
    post: jest.fn().mockResolvedValue(204),
  } as unknown as WebhookHttpClient;
  return { dispatcher: new WebhookDispatcher(dataSource, cipher, http), updates, http };
}

describe('WebhookDispatcher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('assina o raw body e marca 2xx como entregue', async () => {
    const { dispatcher, updates, http } = build();
    await dispatcher.tick();

    const [, body, headers] = (http.post as jest.Mock).mock.calls[0] as [
      string,
      string,
      Record<string, string>,
    ];
    const expected = createHmac('sha256', 'whsec_test')
      .update(`${headers['x-navix-timestamp']}.${body}`)
      .digest('hex');
    expect(headers['x-navix-signature']).toBe(`v1=${expected}`);
    expect(updates.some(({ query }) => query.includes("status='delivered'"))).toBe(true);
  });

  it('leva para dead-letter após a sexta falha', async () => {
    const { dispatcher, updates, http } = build({ ...delivery, attempts: 6 });
    (http.post as jest.Mock).mockResolvedValue(500);
    await dispatcher.tick();
    const failure = updates.find(({ query }) => query.includes('next_attempt_at'));
    expect(failure?.params?.[1]).toBe('dead');
    expect(failure?.params?.[2]).toBe(500);
  });
});
