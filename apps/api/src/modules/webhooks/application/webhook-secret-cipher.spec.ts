import type { AppConfigService } from '../../../shared/config/app-config.service';

import { WebhookSecretCipher } from './webhook-secret-cipher';

describe('WebhookSecretCipher', () => {
  const config = {
    encryption: { kek: 'test-kek-with-at-least-32-characters' },
  } as AppConfigService;

  it('cifra com AES-256-GCM e recupera o segredo', () => {
    const cipher = new WebhookSecretCipher(config);
    const encrypted = cipher.encrypt('whsec_super-secret');
    expect(encrypted).not.toContain('super-secret');
    expect(cipher.decrypt(encrypted)).toBe('whsec_super-secret');
  });

  it('rejeita ciphertext adulterado', () => {
    const cipher = new WebhookSecretCipher(config);
    const encrypted = cipher.encrypt('whsec_super-secret');
    expect(() => cipher.decrypt(`${encrypted.slice(0, -2)}aa`)).toThrow();
  });
});
