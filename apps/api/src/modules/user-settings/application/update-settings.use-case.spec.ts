import { DEFAULT_USER_SETTINGS } from '@navix/contracts';

import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import type { UserSettingsRecord } from '../domain/user-settings';
import type { UserSettingsRepositoryPort } from '../domain/ports/user-settings-repository.port';
import { UpdateSettingsUseCase } from './update-settings.use-case';

/**
 * Testa a lógica de merge/validação isolada da infraestrutura (fakes das ports),
 * conforme docs/coding-standards.md §7.
 */
describe('UpdateSettingsUseCase', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';

  function makeRepo(initial: UserSettingsRecord | null): {
    repo: UserSettingsRepositoryPort;
    saved: () => UserSettingsRecord | null;
  } {
    let stored = initial;
    return {
      repo: {
        find: jest.fn().mockImplementation(async () => stored),
        save: jest.fn().mockImplementation(async (r: UserSettingsRecord) => {
          stored = r;
        }),
      },
      saved: () => stored,
    };
  }

  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('cria a linha a partir dos defaults na primeira escrita e aplica o patch', async () => {
    const { repo, saved } = makeRepo(null);
    const useCase = new UpdateSettingsUseCase(repo, audit);

    const result = await useCase.execute({ tenantId, userId, patch: { theme: 'dark' } });

    expect(result.theme).toBe('dark');
    expect(result.locale).toBe(DEFAULT_USER_SETTINGS.locale);
    expect(saved()?.settings.theme).toBe('dark');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'settings.updated', tenantId, actorId: userId }),
    );
  });

  it('mescla o patch preservando as chaves não enviadas', async () => {
    const initial: UserSettingsRecord = {
      tenantId,
      userId,
      settings: { ...DEFAULT_USER_SETTINGS, theme: 'dark', locale: 'en' },
      updatedAt: new Date(),
    };
    const { repo } = makeRepo(initial);
    const useCase = new UpdateSettingsUseCase(repo, audit);

    const result = await useCase.execute({ tenantId, userId, patch: { compact: true } });

    expect(result.theme).toBe('dark'); // preservado
    expect(result.locale).toBe('en'); // preservado
    expect(result.compact).toBe(true); // atualizado
  });

  it('ignora valores inválidos e mantém o atual', async () => {
    const { repo } = makeRepo(null);
    const useCase = new UpdateSettingsUseCase(repo, audit);

    const result = await useCase.execute({
      tenantId,
      userId,
      // valor fora do conjunto permitido
      patch: { theme: 'neon' as never },
    });

    expect(result.theme).toBe(DEFAULT_USER_SETTINGS.theme);
  });

  it('rejeita patch vazio', async () => {
    const { repo } = makeRepo(null);
    const useCase = new UpdateSettingsUseCase(repo, audit);

    await expect(useCase.execute({ tenantId, userId, patch: {} })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
