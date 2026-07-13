import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import type { StoragePort } from '../../../shared/storage/storage.port';
import type { ProofOfDelivery } from '../domain/proof-of-delivery';
import type { DeliveryOutcomePort, PodRepositoryPort } from '../domain/ports/pod-repository.port';
import { SubmitPodUseCase } from './submit-pod.use-case';

function build(existing: ProofOfDelivery | null = null) {
  const saved: ProofOfDelivery[] = [];
  const outcomes: { deliveryId: string; status: string }[] = [];
  const repo: PodRepositoryPort = {
    save: async (p) => void saved.push(p),
    findByDelivery: async () => existing,
    findAll: async () => ({ items: [], total: 0 }),
    countByStatus: async () => ({ delivered: 0, absent: 0, refused: 0 }),
  };
  const delivery: DeliveryOutcomePort = {
    markOutcome: async (i) => void outcomes.push({ deliveryId: i.deliveryId, status: i.status }),
  };
  const audit: AuditLogPort = { record: async () => undefined };
  const storage: StoragePort = {
    save: async (input) => ({ url: `https://cdn.test/${input.scope}/${input.id}-${input.field}.${input.extension}` }),
    delete: async () => undefined,
  };
  return { uc: new SubmitPodUseCase(repo, delivery, audit, storage), saved, outcomes };
}

const base = { tenantId: 't1', driverId: 'u1', deliveryId: '11111111-1111-1111-1111-111111111111' as const };

describe('SubmitPodUseCase', () => {
  it('entregue: aplica desfecho delivered e salva o comprovante', async () => {
    const { uc, saved, outcomes } = build();
    const view = await uc.execute({ ...base, status: 'delivered', photo: 'data:image/jpeg;base64,x' });
    expect(outcomes[0].status).toBe('delivered');
    expect(saved).toHaveLength(1);
    expect(view.status).toBe('delivered');
    // Mídia foi para o storage: o banco guarda a URL, não a data URL.
    expect(saved[0].photo).toMatch(/^https:\/\/cdn\.test\/pod\/.*-photo\.jpg$/);
    expect(view.photo).toBe(saved[0].photo);
  });

  it('ausente: aplica desfecho failed', async () => {
    const { uc, outcomes } = build();
    const view = await uc.execute({ ...base, status: 'absent', note: 'Ninguém no local' });
    expect(outcomes[0].status).toBe('failed');
    expect(view.status).toBe('absent');
  });

  it('recusado: aplica desfecho failed', async () => {
    const { uc, outcomes } = build();
    await uc.execute({ ...base, status: 'refused' });
    expect(outcomes[0].status).toBe('failed');
  });

  it('entregue sem foto nem assinatura é rejeitado', async () => {
    const { uc } = build();
    await expect(uc.execute({ ...base, status: 'delivered' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita comprovante duplicado', async () => {
    const existing = { id: 'p', deliveryId: base.deliveryId } as unknown as ProofOfDelivery;
    const { uc } = build(existing);
    await expect(uc.execute({ ...base, status: 'absent' })).rejects.toBeInstanceOf(ConflictError);
  });
});
