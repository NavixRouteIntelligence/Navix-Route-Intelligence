import type { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import type { TenantPlanPort } from './ports/tenant-plan.port';
import {
  AutoReoptimizationService,
  type ReoptimizationTriggerPort,
} from './auto-reoptimization.service';

function configWith(autoReoptimize: boolean, debounce = 2000): AppConfigService {
  return { optimizer: { autoReoptimize, reoptimizeDebounceMs: debounce } } as AppConfigService;
}

/** Por padrão, todo tenant é premium — os testes de gate ligam/desligam. */
function planAllowing(allowed = true): TenantPlanPort {
  return { allowsPredictiveAlerts: jest.fn().mockResolvedValue(true),
  allowsDynamicReoptimization: jest.fn().mockResolvedValue(allowed) };
}

/**
 * Drena as microtasks pendentes. O disparo passa por duas promises (gate de
 * plano → trigger), então um único `await` não alcança a métrica no fim.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function metricsSpy(): OptimizerMetrics {
  return {
    observeReoptimizationTrigger: jest.fn(),
    reoptimizationSkipped: jest.fn(),
  } as unknown as OptimizerMetrics;
}

describe('AutoReoptimizationService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('desligado (opt-out): não assina nem dispara', () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(false), trigger, planAllowing(), metricsSpy());
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    jest.advanceTimersByTime(10_000);
    expect(trigger.run).not.toHaveBeenCalled();
    svc.onModuleDestroy();
  });

  it('ligado: debounce coalesce uma rajada em um único disparo por tenant', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(true, 2000), trigger, planAllowing(), metricsSpy());
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    bus.publish('t1', { type: 'delivery.updated', aggregateId: 'd2' });
    jest.advanceTimersByTime(1000); // ainda dentro do debounce
    bus.publish('t1', { type: 'delivery.status-changed', aggregateId: 'd1' });
    expect(trigger.run).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000); // fecha o debounce
    await flush(); // o gate de plano é assíncrono
    expect(trigger.run).toHaveBeenCalledTimes(1);
    expect(trigger.run).toHaveBeenCalledWith('t1');
    svc.onModuleDestroy();
  });

  it('tenants distintos disparam independentemente', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(true, 1000), trigger, planAllowing(), metricsSpy());
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    bus.publish('t2', { type: 'delivery.created', aggregateId: 'd9' });
    jest.advanceTimersByTime(1000);
    await flush();
    expect(trigger.run).toHaveBeenCalledTimes(2);
    expect(trigger.run).toHaveBeenCalledWith('t1');
    expect(trigger.run).toHaveBeenCalledWith('t2');
    svc.onModuleDestroy();
  });

  // A reotimização dinâmica é premium (docs/strategy/pricing-navix.md). Um
  // tenant `free` recebe os eventos, mas nada é enfileirado — fica com a rota
  // que a IA preparou na importação.
  it('plano sem direito: evento chega mas NÃO reotimiza', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const metrics = metricsSpy();
    const svc = new AutoReoptimizationService(
      bus,
      configWith(true, 1000),
      trigger,
      planAllowing(false),
      metrics,
    );
    svc.onModuleInit();

    bus.publish('t-free', { type: 'delivery.created', aggregateId: 'd1' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(trigger.run).not.toHaveBeenCalled();
    expect(metrics.reoptimizationSkipped).toHaveBeenCalledWith('plan');
    svc.onModuleDestroy();
  });

  it('atraso detectado também dispara a reotimização', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(
      bus,
      configWith(true, 1000),
      trigger,
      planAllowing(),
      metricsSpy(),
    );
    svc.onModuleInit();

    bus.publish('t1', { type: 'route.delay-detected', aggregateId: 't1' });
    jest.advanceTimersByTime(1000);
    await flush();

    expect(trigger.run).toHaveBeenCalledWith('t1');
    svc.onModuleDestroy();
  });

  // A posição por si só não pode reotimizar: chega a cada poucos segundos.
  // Quem filtra é o DelayDetectionService, publicando route.delay-detected.
  it('posição de motorista NÃO dispara reotimização sozinha', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(
      bus,
      configWith(true, 1000),
      trigger,
      planAllowing(),
      metricsSpy(),
    );
    svc.onModuleInit();

    bus.publish('t1', { type: 'tracking.position-recorded', aggregateId: 'driver-1' });
    jest.advanceTimersByTime(5000);
    await flush();

    expect(trigger.run).not.toHaveBeenCalled();
    svc.onModuleDestroy();
  });

  // O SLA mede do PRIMEIRO evento da rajada, não do último: reagendar o
  // debounce não pode "zerar" o relógio e maquiar a latência.
  it('mede a latência a partir do primeiro evento da rajada', async () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const metrics = metricsSpy();
    const svc = new AutoReoptimizationService(
      bus,
      configWith(true, 1000),
      trigger,
      planAllowing(),
      metrics,
    );
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    jest.advanceTimersByTime(500);
    bus.publish('t1', { type: 'delivery.updated', aggregateId: 'd2' }); // reagenda
    jest.advanceTimersByTime(1000);
    await flush();

    expect(metrics.observeReoptimizationTrigger).toHaveBeenCalled();
    const seconds = (metrics.observeReoptimizationTrigger as jest.Mock).mock.calls[0][0] as number;
    // ~1,5s (500ms + 1000ms), e não apenas o último debounce de 1s.
    expect(seconds).toBeGreaterThanOrEqual(1.4);
    svc.onModuleDestroy();
  });
});
