import type { DataSource, EntityManager } from 'typeorm';
import type { RealtimeEvent } from '@navix/contracts';

import type { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import type { RealtimeHub } from '../../../shared/realtime/realtime-hub';
import type { DeliveryLookupPort } from '../../delivery/application/delivery-lookup.service';
import type { NotifyRecipientUseCase } from '../../notifications/application/notify-recipient.use-case';
import type { OptimizerServicePort } from '../../optimizer/application/optimizer.service';
import type { TenantPlanPort } from '../../optimizer/application/ports/tenant-plan.port';
import { DelayRiskAlertListener } from './delay-risk-alert.listener';
import type { AssessedStop, PredictBreachRiskUseCase } from './predict-breach-risk.use-case';

const TENANT = 'tenant-a';
const ENTREGA = 'entrega-1';

const previsto = new Date('2026-07-31T10:00:00Z');
const fimDaJanela = new Date('2026-07-31T10:30:00Z');

function risco(level: 'low' | 'medium' | 'high', probability: number): AssessedStop {
  return {
    deliveryId: ENTREGA,
    predictedArrival: previsto,
    windowEnd: fimDaJanela,
    risk: { probability, level, slackMinutes: 30, samples: 40 },
  };
}

function build(opts: {
  premium?: boolean;
  enabled?: boolean;
  avaliadas?: AssessedStop[];
  intervaloMs?: number;
} = {}) {
  // Registra os `set_config` executados: é como o teste prova que a RLS foi
  // estabelecida antes de qualquer leitura.
  const tenantSets: string[] = [];
  const manager = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('app.current_tenant')) tenantSets.push(String(params?.[0]));
      return Promise.resolve([]);
    }),
    getRepository: jest.fn(),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: (fn: (m: EntityManager) => Promise<unknown>) => fn(manager),
  } as unknown as DataSource;

  const bus = new DomainEventBus();
  const config = {
    delayRiskAlerts: {
      enabled: opts.enabled ?? true,
      checkIntervalMs: opts.intervaloMs ?? 0,
    },
  } as unknown as AppConfigService;

  const execute = jest.fn().mockResolvedValue(opts.avaliadas ?? []);
  const predict = { execute } as unknown as PredictBreachRiskUseCase;

  const listNotifiableActive = jest.fn().mockResolvedValue([
    { id: ENTREGA, status: 'in_route', driverId: 'ficha-1', latitude: 0, longitude: 0 },
  ]);
  const getStops = jest.fn().mockResolvedValue([
    { id: ENTREGA, timeWindow: { start: previsto.toISOString(), end: fimDaJanela.toISOString() } },
  ]);
  const deliveries = { listNotifiableActive, getStops } as unknown as DeliveryLookupPort;

  const optimizer = {
    etaPredictionForDelivery: jest
      .fn()
      .mockResolvedValue({ routePlanId: 'p1', arrivalAt: previsto, correctionMinutes: 0 }),
  } as unknown as OptimizerServicePort;

  const allowsPredictiveAlerts = jest.fn().mockResolvedValue(opts.premium ?? true);
  const plan = {
    allowsPredictiveAlerts,
    allowsDynamicReoptimization: jest.fn(),
  } as TenantPlanPort;

  const publicados: RealtimeEvent[] = [];
  const realtime = {
    publish: jest.fn((_t: string, e: RealtimeEvent) => void publicados.push(e)),
  } as unknown as RealtimeHub;

  const notificar = jest.fn().mockResolvedValue(undefined);
  const notify = { execute: notificar } as unknown as NotifyRecipientUseCase;

  const listener = new DelayRiskAlertListener(
    dataSource,
    bus,
    config,
    predict,
    deliveries,
    optimizer,
    plan,
    realtime,
    notify,
  );

  return {
    listener,
    bus,
    publicados,
    notificar,
    execute,
    allowsPredictiveAlerts,
    listNotifiableActive,
    tenantSets,
  };
}

/** Dispara o tick e espera as promessas pendentes do listener. */
async function tick(bus: DomainEventBus): Promise<void> {
  bus.publish(TENANT, { type: 'tracking.position-recorded', aggregateId: 'ficha-1' });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

describe('DelayRiskAlertListener (ADR-0091)', () => {
  it('publica alerta à empresa quando há risco relevante', async () => {
    const { listener, bus, publicados } = build({ avaliadas: [risco('medium', 0.45)] });
    listener.onModuleInit();

    await tick(bus);

    expect(publicados).toHaveLength(1);
    expect(publicados[0]).toMatchObject({
      type: 'alert.delay-risk',
      data: { deliveryId: ENTREGA, severity: 'medium', probability: 0.45, driverId: 'ficha-1' },
    });
    listener.onModuleDestroy();
  });

  // À empresa vai todo risco relevante; ao destinatário, só o alto — avisar de
  // uma suspeita que não se confirma corrói a confiança no aviso seguinte.
  it('risco médio não chega ao destinatário', async () => {
    const { listener, bus, notificar } = build({ avaliadas: [risco('medium', 0.45)] });
    listener.onModuleInit();

    await tick(bus);

    expect(notificar).not.toHaveBeenCalled();
    listener.onModuleDestroy();
  });

  it('risco alto avisa o destinatário pela via que já existe', async () => {
    const { listener, bus, notificar } = build({ avaliadas: [risco('high', 0.8)] });
    listener.onModuleInit();

    await tick(bus);

    expect(notificar).toHaveBeenCalledWith(TENANT, ENTREGA, 'delayed');
    listener.onModuleDestroy();
  });

  it('risco baixo não gera alerta nenhum', async () => {
    const { listener, bus, publicados, notificar } = build({ avaliadas: [risco('low', 0.1)] });
    listener.onModuleInit();

    await tick(bus);

    expect(publicados).toHaveLength(0);
    expect(notificar).not.toHaveBeenCalled();
    listener.onModuleDestroy();
  });

  // Recurso pago não gasta banco de quem não paga: o gate vem antes da consulta.
  it('tenant sem plano premium nem chega a consultar as entregas', async () => {
    const { listener, bus, publicados, listNotifiableActive } = build({
      premium: false,
      avaliadas: [risco('high', 0.9)],
    });
    listener.onModuleInit();

    await tick(bus);

    expect(listNotifiableActive).not.toHaveBeenCalled();
    expect(publicados).toHaveLength(0);
    listener.onModuleDestroy();
  });

  it('flag mestre desligada não assina o evento', async () => {
    const { listener, bus, allowsPredictiveAlerts } = build({ enabled: false });
    listener.onModuleInit();

    await tick(bus);

    expect(allowsPredictiveAlerts).not.toHaveBeenCalled();
    listener.onModuleDestroy();
  });

  // Posição chega a cada poucos segundos; reavaliar a rota inteira a cada uma
  // seria insano.
  it('throttle limita a uma avaliação por tenant no intervalo', async () => {
    const { listener, bus, execute } = build({
      avaliadas: [risco('medium', 0.4)],
      intervaloMs: 60_000,
    });
    listener.onModuleInit();

    await tick(bus);
    await tick(bus);
    await tick(bus);

    expect(execute).toHaveBeenCalledTimes(1);
    listener.onModuleDestroy();
  });

  // A avaliação é feita sob a RLS do tenant: fora de requisição ela não dá erro,
  // só devolve zero linhas, e o alerta sumiria em silêncio.
  it('estabelece app.current_tenant antes de avaliar', async () => {
    const { listener, bus, tenantSets } = build({ avaliadas: [risco('high', 0.9)] });
    listener.onModuleInit();

    await tick(bus);

    expect(tenantSets).toEqual([TENANT]);
    listener.onModuleDestroy();
  });

  it('tenant sem plano não abre transação alguma', async () => {
    const { listener, bus, tenantSets } = build({ premium: false });
    listener.onModuleInit();

    await tick(bus);

    expect(tenantSets).toEqual([]);
    listener.onModuleDestroy();
  });
});
