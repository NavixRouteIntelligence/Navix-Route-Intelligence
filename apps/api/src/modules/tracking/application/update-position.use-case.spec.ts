import { ValidationError } from '../../../shared/kernel/domain-error';
import type { DriverPosition } from '../domain/driver-position';
import type { PositionRepositoryPort } from '../domain/ports/position-repository.port';
import type { TrackingEventsPort } from '../domain/ports/tracking-events.port';
import type { DriverAccountLinkPort } from './ports/driver-account-link.port';
import { UpdatePositionUseCase } from './update-position.use-case';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';

/** Por padrão o login não tem ficha (autônomo): o id anunciado é o do login. */
function build(fichaPorLogin: Record<string, string> = {}) {
  const saved: DriverPosition[] = [];
  const repo: PositionRepositoryPort = {
    save: async (p) => void saved.push(p),
    saveMany: async (ps) => void saved.push(...ps),
    findLatestForDriver: async () => null,
    findLatestPerDriver: async () => [],
    findHistory: async () => [],
    pruneOlderThan: async () => 0,
  };
  const events: TrackingEventsPort & { positionUpdated: jest.Mock } = {
    positionUpdated: jest.fn(),
  };
  const link: DriverAccountLinkPort = {
    userIdForDriver: jest.fn(),
    driverIdsForUsers: jest.fn(async (_t: string, ids: string[]) =>
      new Map(ids.filter((id) => fichaPorLogin[id]).map((id) => [id, fichaPorLogin[id]])),
    ),
  };
  const bus = new DomainEventBus();
  return {
    uc: new UpdatePositionUseCase(repo, events, link, bus),
    saved,
    events,
    bus,
    link,
  };
}

const base = { tenantId: 't1', driverId: 'u1', latitude: -23.55, longitude: -46.63 };

describe('UpdatePositionUseCase', () => {
  it('persiste a posição, publica em tempo real e retorna a view (en_route padrão)', async () => {
    const { uc, saved, events } = build();
    const view = await uc.execute({ ...base, speed: 40, heading: 90 });
    expect(saved).toHaveLength(1);
    expect(saved[0].driverId).toBe('u1');
    expect(view.status).toBe('en_route');
    expect(view.speed).toBe(40);
    expect(events.positionUpdated).toHaveBeenCalledWith('t1', view);
  });

  it('aceita status finished reportado', async () => {
    const { uc } = build();
    const view = await uc.execute({ ...base, status: 'finished' });
    expect(view.status).toBe('finished');
  });

  it('rejeita coordenadas inválidas', async () => {
    const { uc } = build();
    await expect(uc.execute({ ...base, latitude: 200 })).rejects.toBeInstanceOf(ValidationError);
  });

  // A junção ficha↔login (ADR-0086). A linha é gravada sob o LOGIN, mas o que
  // sai daqui é anunciado sob a FICHA: todos os assinantes vêm do lado da
  // frota e partem da entrega, que aponta para a ficha.
  describe('identificador anunciado (ADR-0086)', () => {
    function eventosDe(bus: DomainEventBus): { type: string; aggregateId: string }[] {
      const capturados: { type: string; aggregateId: string }[] = [];
      bus.stream().subscribe((m) =>
        capturados.push({ type: m.event.type, aggregateId: m.event.aggregateId }),
      );
      return capturados;
    }

    it('grava sob o login e anuncia sob a ficha', async () => {
      const { uc, saved, events, bus } = build({ u1: 'ficha-1' });
      const capturados = eventosDe(bus);

      const view = await uc.execute({ ...base });

      expect(saved[0].driverId).toBe('u1');
      expect(view.driverId).toBe('ficha-1');
      expect(events.positionUpdated).toHaveBeenCalledWith('t1', view);
      expect(capturados).toEqual([
        { type: 'tracking.position-recorded', aggregateId: 'ficha-1' },
      ]);
    });

    it('motorista autônomo (sem ficha) é anunciado sob o próprio login', async () => {
      const { uc, bus } = build();
      const capturados = eventosDe(bus);

      const view = await uc.execute({ ...base });

      expect(view.driverId).toBe('u1');
      expect(capturados[0].aggregateId).toBe('u1');
    });

    // A posição já está salva quando a tradução roda: perder o aviso vale menos
    // do que perder o ponto.
    it('falha ao traduzir não derruba a gravação', async () => {
      const { uc, saved, link, bus } = build();
      (link.driverIdsForUsers as jest.Mock).mockRejectedValue(new Error('fleet fora do ar'));
      const capturados = eventosDe(bus);

      const view = await uc.execute({ ...base });

      expect(saved).toHaveLength(1);
      expect(view.driverId).toBe('u1');
      expect(capturados[0].aggregateId).toBe('u1');
    });
  });
});
