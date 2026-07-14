import type { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import {
  AutoReoptimizationService,
  type ReoptimizationTriggerPort,
} from './auto-reoptimization.service';

function configWith(autoReoptimize: boolean, debounce = 2000): AppConfigService {
  return { optimizer: { autoReoptimize, reoptimizeDebounceMs: debounce } } as AppConfigService;
}

describe('AutoReoptimizationService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('desligado (opt-out): não assina nem dispara', () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(false), trigger);
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    jest.advanceTimersByTime(10_000);
    expect(trigger.run).not.toHaveBeenCalled();
    svc.onModuleDestroy();
  });

  it('ligado: debounce coalesce uma rajada em um único disparo por tenant', () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(true, 2000), trigger);
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    bus.publish('t1', { type: 'delivery.updated', aggregateId: 'd2' });
    jest.advanceTimersByTime(1000); // ainda dentro do debounce
    bus.publish('t1', { type: 'delivery.status-changed', aggregateId: 'd1' });
    expect(trigger.run).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000); // fecha o debounce
    expect(trigger.run).toHaveBeenCalledTimes(1);
    expect(trigger.run).toHaveBeenCalledWith('t1');
    svc.onModuleDestroy();
  });

  it('tenants distintos disparam independentemente', () => {
    const bus = new DomainEventBus();
    const trigger: ReoptimizationTriggerPort = { run: jest.fn().mockResolvedValue(undefined) };
    const svc = new AutoReoptimizationService(bus, configWith(true, 1000), trigger);
    svc.onModuleInit();

    bus.publish('t1', { type: 'delivery.created', aggregateId: 'd1' });
    bus.publish('t2', { type: 'delivery.created', aggregateId: 'd9' });
    jest.advanceTimersByTime(1000);
    expect(trigger.run).toHaveBeenCalledTimes(2);
    expect(trigger.run).toHaveBeenCalledWith('t1');
    expect(trigger.run).toHaveBeenCalledWith('t2');
    svc.onModuleDestroy();
  });
});
