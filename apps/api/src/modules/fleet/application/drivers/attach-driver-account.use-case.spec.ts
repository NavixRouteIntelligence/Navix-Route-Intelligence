import type { AuditLogPort } from '../../../../shared/audit/audit-log.port';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/kernel/domain-error';
import type { DriverRepositoryPort } from '../../domain/ports/driver-repository.port';
import { Driver } from '../../domain/driver';
import { AttachDriverAccountUseCase } from './attach-driver-account.use-case';

const TENANT = 'tenant-a';
const USER = '11111111-1111-1111-1111-111111111111';

function build(opts: { found?: Driver | null; userLinked?: boolean; licenseTaken?: boolean } = {}) {
  const save = jest.fn().mockResolvedValue(undefined);
  const drivers: DriverRepositoryPort = {
    save,
    findById: jest.fn().mockResolvedValue(opts.found ?? null),
    findAll: jest.fn(),
    existsByLicense: jest.fn().mockResolvedValue(opts.licenseTaken ?? false),
    existsByUser: jest.fn().mockResolvedValue(opts.userLinked ?? false),
    findUserIdById: jest.fn().mockResolvedValue(null),
    findIdsByUserIds: jest.fn().mockResolvedValue(new Map()),
    delete: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  return { uc: new AttachDriverAccountUseCase(drivers, audit), drivers, save };
}

function ficha(userId: string | null = null): Driver {
  const d = Driver.create({ tenantId: TENANT, name: 'Maria Souza', licenseNumber: 'CNH-1' });
  if (userId) d.linkAccount(userId);
  return d;
}

describe('AttachDriverAccountUseCase', () => {
  it('liga o login à ficha existente', async () => {
    const alvo = ficha();
    const { uc, save } = build({ found: alvo });

    const result = await uc.execute({ tenantId: TENANT, userId: USER, driverId: alvo.id });

    expect(result.driverId).toBe(alvo.id);
    expect(alvo.userId).toBe(USER);
    expect(save).toHaveBeenCalledWith(alvo);
  });

  // A busca é escopada por tenant e passa pela RLS: ficha de outra organização
  // simplesmente não aparece, e o vínculo não acontece.
  it('ficha de outro tenant não é encontrada', async () => {
    const { uc, save } = build({ found: null });

    await expect(
      uc.execute({ tenantId: TENANT, userId: USER, driverId: 'ficha-alheia' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(save).not.toHaveBeenCalled();
  });

  it('um login não se espalha por duas fichas', async () => {
    const { uc, save } = build({ found: ficha(), userLinked: true });

    await expect(
      uc.execute({ tenantId: TENANT, userId: USER, driverId: 'ficha-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(save).not.toHaveBeenCalled();
  });

  it('uma ficha já vinculada não é reatribuída a outro login', async () => {
    const ocupada = ficha('99999999-9999-9999-9999-999999999999');
    const { uc } = build({ found: ocupada });

    await expect(
      uc.execute({ tenantId: TENANT, userId: USER, driverId: ocupada.id }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('cria a ficha já vinculada quando o convite não tinha uma', async () => {
    const { uc, save } = build();

    await uc.execute({
      tenantId: TENANT,
      userId: USER,
      driverId: null,
      name: 'João Aguiar',
      licenseNumber: 'cnh-42',
    });

    const criada = save.mock.calls[0][0] as Driver;
    const snap = criada.snapshot();
    expect(snap).toMatchObject({ tenantId: TENANT, name: 'João Aguiar', licenseNumber: 'CNH-42' });
    expect(criada.userId).toBe(USER);
  });

  it('sem ficha e sem dados do motorista, recusa', async () => {
    const { uc, save } = build();

    await expect(uc.execute({ tenantId: TENANT, userId: USER })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('CNH duplicada no tenant é conflito', async () => {
    const { uc, save } = build({ licenseTaken: true });

    await expect(
      uc.execute({ tenantId: TENANT, userId: USER, name: 'João', licenseNumber: 'CNH-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(save).not.toHaveBeenCalled();
  });
});
