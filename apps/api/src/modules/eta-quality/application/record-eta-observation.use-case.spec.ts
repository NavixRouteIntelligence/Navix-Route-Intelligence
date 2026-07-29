import type {
  DeliveryLookupPort,
  DeliveryPublicSnapshot,
} from '../../delivery/application/delivery-lookup.service';
import type { OptimizerServicePort } from '../../optimizer/application/optimizer.service';
import type { EtaObservation } from '../domain/eta-observation';
import type { EtaObservationRepositoryPort } from '../domain/ports/eta-observation-repository.port';
import { RecordEtaObservationUseCase } from './record-eta-observation.use-case';

const TENANT = 'tenant-a';
const ENTREGA = 'entrega-1';
const PLANO = 'plano-1';

function snapshot(status: DeliveryPublicSnapshot['status']): DeliveryPublicSnapshot {
  return { status, driverId: 'ficha-1', latitude: 38.7223, longitude: -9.1393 };
}

function build(opts: {
  delivery?: DeliveryPublicSnapshot | null;
  prediction?: { routePlanId: string; arrivalAt: Date } | null;
  jaMedida?: boolean;
} = {}) {
  const gravadas: EtaObservation[] = [];
  const observations: EtaObservationRepositoryPort = {
    record: jest.fn(async (o: EtaObservation) => {
      if (opts.jaMedida) return false;
      gravadas.push(o);
      return true;
    }),
    recentErrors: jest.fn(),
  };
  const deliveries = {
    getPublicSnapshot: jest
      .fn()
      .mockResolvedValue(opts.delivery === undefined ? snapshot('delivered') : opts.delivery),
  } as unknown as DeliveryLookupPort;
  const optimizer = {
    estimate: jest.fn(),
    optimizeDeliveries: jest.fn(),
    etaForDelivery: jest.fn(),
    etaPredictionForDelivery: jest.fn().mockResolvedValue(opts.prediction ?? null),
  } as OptimizerServicePort;

  return {
    uc: new RecordEtaObservationUseCase(observations, deliveries, optimizer),
    gravadas,
    observations,
    optimizer,
  };
}

describe('RecordEtaObservationUseCase (ADR-0087)', () => {
  const previsto = new Date('2026-07-29T10:00:00Z');
  const real = new Date('2026-07-29T10:12:00Z');

  it('fecha o par previsão↔real de uma entrega concluída', async () => {
    const { uc, gravadas } = build({
      prediction: { routePlanId: PLANO, arrivalAt: previsto },
    });

    const medicao = await uc.execute(TENANT, ENTREGA, real);

    expect(medicao).not.toBeNull();
    expect(gravadas[0]).toMatchObject({
      tenantId: TENANT,
      deliveryId: ENTREGA,
      routePlanId: PLANO,
      predictedArrivalAt: previsto,
      actualArrivalAt: real,
      errorMinutes: 12,
      source: 'status_change',
    });
  });

  // A célula precisa ser a MESMA da inteligência coletiva (~110 m), senão as
  // duas fontes nunca viram feature do mesmo modelo.
  it('materializa célula e hora da semana como features', async () => {
    const { uc, gravadas } = build({
      prediction: { routePlanId: PLANO, arrivalAt: previsto },
    });

    await uc.execute(TENANT, ENTREGA, real);

    expect(gravadas[0].cell).toBe('38.722,-9.139');
    expect(gravadas[0].hourOfWeek).toBe(real.getDay() * 24 + real.getHours());
  });

  // Só a conclusão define o instante real de chegada.
  it.each(['pending', 'in_route', 'failed', 'canceled'] as const)(
    'não mede entrega em %s',
    async (status) => {
      const { uc, observations } = build({ delivery: snapshot(status) });

      await expect(uc.execute(TENANT, ENTREGA, real)).resolves.toBeNull();
      expect(observations.record).not.toHaveBeenCalled();
    },
  );

  it('entrega invisível ao tenant não vira medição', async () => {
    const { uc, observations } = build({ delivery: null });

    await expect(uc.execute(TENANT, ENTREGA, real)).resolves.toBeNull();
    expect(observations.record).not.toHaveBeenCalled();
  });

  // Sem plano vigente há o real, mas não há o que comparar. A linha ainda é
  // gravada — o desfecho tem valor —, com erro nulo para ficar fora da média.
  it('sem plano vigente, grava sem erro em vez de fingir acerto', async () => {
    const { uc, gravadas } = build({ prediction: null });

    const medicao = await uc.execute(TENANT, ENTREGA, real);

    expect(medicao).not.toBeNull();
    expect(gravadas[0]).toMatchObject({
      routePlanId: null,
      predictedArrivalAt: null,
      errorMinutes: null,
      actualArrivalAt: real,
    });
  });

  // O listener pode reprocessar o mesmo evento; a métrica não pode contar duas
  // vezes a mesma entrega.
  it('entrega já medida não gera segunda amostra', async () => {
    const { uc } = build({
      prediction: { routePlanId: PLANO, arrivalAt: previsto },
      jaMedida: true,
    });

    await expect(uc.execute(TENANT, ENTREGA, real)).resolves.toBeNull();
  });

  it('chegar adiantado dá erro negativo', async () => {
    const { uc, gravadas } = build({
      prediction: { routePlanId: PLANO, arrivalAt: new Date('2026-07-29T10:20:00Z') },
    });

    await uc.execute(TENANT, ENTREGA, real);

    expect(gravadas[0].errorMinutes).toBe(-8);
  });
});
