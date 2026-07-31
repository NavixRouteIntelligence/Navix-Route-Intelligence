import type { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import {
  AutoReoptimizationService,
  type ReoptimizationTriggerPort,
} from './auto-reoptimization.service';
import { DelayDetectionService, type RouteDelayEvaluatorPort } from './delay-detection.service';
import type { TenantPlanPort } from './ports/tenant-plan.port';
import { ReoptimizeActiveUseCase } from './reoptimize-active.use-case';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';

/**
 * Fluxo **ponta a ponta** da reotimização dinâmica (ADR-0083), com as peças
 * reais ligadas entre si: bus → detector/debounce → gate de plano → trigger →
 * `ReoptimizeActiveUseCase` → fila.
 *
 * Os únicos dublês são as fronteiras de I/O (banco e fila) — o caminho de
 * decisão é o de produção.
 */
function buildWorld(opts: { premium?: boolean; delayMinutes?: number } = {}) {
  const bus = new DomainEventBus();

  const config = {
    optimizer: {
      autoReoptimize: true,
      reoptimizeDebounceMs: 1000,
      delayCheckIntervalMs: 60_000,
      delayThresholdMinutes: 10,
    },
  } as AppConfigService;

  // Fronteira de I/O 1: a fila. Registra o que seria enfileirado.
  const enqueued: { tenantId: string; deliveryIds: string[] }[] = [];
  const enqueue = {
    execute: jest.fn(async (cmd: { tenantId: string; actorId: string; deliveryIds: string[] }) => {
      enqueued.push({ tenantId: cmd.tenantId, deliveryIds: cmd.deliveryIds });
      return { jobId: `job-${enqueued.length}`, status: 'queued' as const };
    }),
  } as unknown as EnqueueOptimizationUseCase;

  // Fronteira de I/O 2: as entregas ativas do tenant.
  const delivery = {
    listActiveStops: jest.fn().mockResolvedValue([
      { id: 'd1', latitude: 38.7, longitude: -9.1, priority: 'normal', timeWindow: null },
      { id: 'd2', latitude: 38.8, longitude: -9.2, priority: 'high', timeWindow: null },
    ]),
  } as unknown as DeliveryGatewayPort;

  const reoptimize = new ReoptimizeActiveUseCase(delivery, enqueue);

  // O trigger real estabeleceria a transação de tenant; aqui chamamos o caso de
  // uso direto, que é o que ele faz depois de abrir a transação.
  const trigger: ReoptimizationTriggerPort = {
    run: (tenantId) => reoptimize.execute({ tenantId, actorId: 'system' }).then(() => undefined),
  };

  const plans: TenantPlanPort = {
    allowsPredictiveAlerts: jest.fn().mockResolvedValue(true),
  allowsDynamicReoptimization: jest.fn().mockResolvedValue(opts.premium ?? true),
  };
  const metrics = {
    observeReoptimizationTrigger: jest.fn(),
    reoptimizationSkipped: jest.fn(),
  } as unknown as OptimizerMetrics;

  const evaluator: RouteDelayEvaluatorPort = {
    evaluate: jest.fn().mockResolvedValue(opts.delayMinutes ?? 0),
  };

  const auto = new AutoReoptimizationService(bus, config, trigger, plans, metrics);
  const detector = new DelayDetectionService(bus, config, evaluator);
  auto.onModuleInit();
  detector.onModuleInit();

  return {
    bus,
    enqueued,
    delivery,
    metrics,
    stop: () => {
      auto.onModuleDestroy();
      detector.onModuleDestroy();
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('Reotimização dinâmica — fluxo evento → reenfileirar → plano', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('nova entrega reenfileira a otimização das ativas', async () => {
    const w = buildWorld();

    w.bus.publish('t1', { type: 'delivery.created', aggregateId: 'd3' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued).toEqual([{ tenantId: 't1', deliveryIds: ['d1', 'd2'] }]);
    w.stop();
  });

  it('cancelamento (exclusão) também reenfileira', async () => {
    const w = buildWorld();

    w.bus.publish('t1', { type: 'delivery.deleted', aggregateId: 'd9' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued).toHaveLength(1);
    w.stop();
  });

  // O caminho novo: posição → detector mede atraso → publica delay-detected →
  // debounce → reenfileira. Nenhuma peça do motor foi tocada.
  it('atraso detectado a partir de uma posição reenfileira a rota', async () => {
    const w = buildWorld({ delayMinutes: 22 });

    w.bus.publish('t1', { type: 'tracking.position-recorded', aggregateId: 'driver-1' });
    await flush(); // detector avalia e publica route.delay-detected
    jest.advanceTimersByTime(1000); // fecha o debounce
    await flush();

    expect(w.enqueued).toEqual([{ tenantId: 't1', deliveryIds: ['d1', 'd2'] }]);
    w.stop();
  });

  it('rota no horário: posição não gera reotimização', async () => {
    const w = buildWorld({ delayMinutes: 2 });

    w.bus.publish('t1', { type: 'tracking.position-recorded', aggregateId: 'driver-1' });
    await flush();
    jest.advanceTimersByTime(5000);
    await flush();

    expect(w.enqueued).toHaveLength(0);
    w.stop();
  });

  it('tenant sem plano premium: evento não vira job', async () => {
    const w = buildWorld({ premium: false });

    w.bus.publish('t-free', { type: 'delivery.created', aggregateId: 'd3' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued).toHaveLength(0);
    expect(w.metrics.reoptimizationSkipped).toHaveBeenCalledWith('plan');
    w.stop();
  });

  // Import em massa dispara dezenas de eventos: o debounce tem de virar UM job.
  it('rajada de eventos vira um único job', async () => {
    const w = buildWorld();

    for (let i = 0; i < 25; i++) {
      w.bus.publish('t1', { type: 'delivery.created', aggregateId: `d${i}` });
      jest.advanceTimersByTime(50);
    }
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued).toHaveLength(1);
    w.stop();
  });

  // Menos de 2 paradas ativas não é rota: o caso de uso devolve no-op.
  it('sem paradas suficientes, nada é enfileirado', async () => {
    const w = buildWorld();
    (w.delivery.listActiveStops as jest.Mock).mockResolvedValue([
      { id: 'd1', latitude: 38.7, longitude: -9.1, priority: 'normal', timeWindow: null },
    ]);

    w.bus.publish('t1', { type: 'delivery.created', aggregateId: 'd3' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued).toHaveLength(0);
    w.stop();
  });

  it('tenants distintos não se misturam', async () => {
    const w = buildWorld();

    w.bus.publish('t1', { type: 'delivery.created', aggregateId: 'd3' });
    w.bus.publish('t2', { type: 'delivery.created', aggregateId: 'd4' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(w.enqueued.map((e) => e.tenantId).sort()).toEqual(['t1', 't2']);
    w.stop();
  });
});
