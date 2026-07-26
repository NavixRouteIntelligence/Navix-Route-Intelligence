import type { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import type { TenantDomainEvent } from '../../../shared/events/domain-event-bus';
import {
  DelayDetectionService,
  type RouteDelayEvaluatorPort,
} from './delay-detection.service';

function config(overrides: Partial<{ autoReoptimize: boolean; interval: number; threshold: number }> = {}): AppConfigService {
  return {
    optimizer: {
      autoReoptimize: overrides.autoReoptimize ?? true,
      delayCheckIntervalMs: overrides.interval ?? 60_000,
      delayThresholdMinutes: overrides.threshold ?? 10,
    },
  } as AppConfigService;
}

/** Coleta os eventos publicados no bus, para afirmar o que foi disparado. */
function collect(bus: DomainEventBus): TenantDomainEvent[] {
  const seen: TenantDomainEvent[] = [];
  bus.stream().subscribe((m) => seen.push(m));
  return seen;
}

const position = { type: 'tracking.position-recorded', aggregateId: 'driver-1' } as const;

describe('DelayDetectionService', () => {
  it('desligado: não avalia nada', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = { evaluate: jest.fn() };
    const svc = new DelayDetectionService(bus, config({ autoReoptimize: false }), evaluator);
    svc.onModuleInit();

    bus.publish('t1', position);
    await Promise.resolve();

    expect(evaluator.evaluate).not.toHaveBeenCalled();
    svc.onModuleDestroy();
  });

  it('atraso acima do limiar publica route.delay-detected', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = { evaluate: jest.fn().mockResolvedValue(25) };
    const svc = new DelayDetectionService(bus, config({ threshold: 10 }), evaluator);
    svc.onModuleInit();
    const seen = collect(bus);

    bus.publish('t1', position);
    await new Promise((r) => setImmediate(r));

    const delay = seen.find((m) => m.event.type === 'route.delay-detected');
    expect(delay).toBeDefined();
    expect(delay?.tenantId).toBe('t1');
    svc.onModuleDestroy();
  });

  it('atraso abaixo do limiar não dispara nada', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = { evaluate: jest.fn().mockResolvedValue(3) };
    const svc = new DelayDetectionService(bus, config({ threshold: 10 }), evaluator);
    svc.onModuleInit();
    const seen = collect(bus);

    bus.publish('t1', position);
    await new Promise((r) => setImmediate(r));

    expect(seen.some((m) => m.event.type === 'route.delay-detected')).toBe(false);
    svc.onModuleDestroy();
  });

  // Posições chegam a cada poucos segundos; sem throttle o detector leria o
  // plano e as entregas dezenas de vezes por minuto e por tenant.
  it('throttle: várias posições seguidas geram UMA avaliação', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = { evaluate: jest.fn().mockResolvedValue(0) };
    const svc = new DelayDetectionService(bus, config({ interval: 60_000 }), evaluator);
    svc.onModuleInit();

    for (let i = 0; i < 5; i++) {
      bus.publish('t1', position);
      await new Promise((r) => setImmediate(r));
    }

    expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
    svc.onModuleDestroy();
  });

  it('o throttle é por tenant (um não silencia o outro)', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = { evaluate: jest.fn().mockResolvedValue(0) };
    const svc = new DelayDetectionService(bus, config(), evaluator);
    svc.onModuleInit();

    bus.publish('t1', position);
    await new Promise((r) => setImmediate(r));
    bus.publish('t2', position);
    await new Promise((r) => setImmediate(r));

    expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
    expect(evaluator.evaluate).toHaveBeenCalledWith('t1');
    expect(evaluator.evaluate).toHaveBeenCalledWith('t2');
    svc.onModuleDestroy();
  });

  // Avaliar atraso é best-effort: não pode derrubar a ingestão de posições,
  // que é o caminho crítico do motorista em rota.
  it('falha do avaliador não propaga', async () => {
    const bus = new DomainEventBus();
    const evaluator: RouteDelayEvaluatorPort = {
      evaluate: jest.fn().mockRejectedValue(new Error('banco fora')),
    };
    const svc = new DelayDetectionService(bus, config(), evaluator);
    svc.onModuleInit();

    expect(() => bus.publish('t1', position)).not.toThrow();
    await new Promise((r) => setImmediate(r));
    svc.onModuleDestroy();
  });
});
