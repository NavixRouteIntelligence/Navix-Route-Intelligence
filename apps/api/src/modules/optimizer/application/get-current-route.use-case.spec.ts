import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import type { DeliveryGatewayPort, RouteViewDeliveryStop } from './ports/delivery-gateway.port';
import type { GetActiveRoutePlanUseCase } from './get-active-route-plan.use-case';
import { GetCurrentRouteUseCase } from './get-current-route.use-case';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';

function parada(sequence: number, deliveryId: string) {
  return { sequence, deliveryId, etaMinutes: sequence * 10, legDistanceKm: 1, legMinutes: 10 };
}

function plano(ids: string[]): RoutePlanView {
  return {
    id: 'plan-1',
    operationalDay: '2026-08-09',
    status: 'completed',
    departureAt: '2026-08-09T08:00:00.000Z',
    metrics: { totalDistanceKm: 10, totalTimeMinutes: 60, stops: ids.length },
    savings: { distanceKm: 1, distancePct: 9, timeMinutes: 5, timePct: 8 },
    params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
    stops: ids.map((id, i) => parada(i + 1, id)),
  } as unknown as RoutePlanView;
}

function entrega(id: string, over: Partial<RouteViewDeliveryStop> = {}): RouteViewDeliveryStop {
  return {
    id,
    addressText: `Rua ${id}`,
    status: 'pending',
    priority: 'normal',
    timeWindow: null,
    latitude: 38.7,
    longitude: -9.1,
    ...over,
  };
}

function build(planoView: RoutePlanView | null, entregas: RouteViewDeliveryStop[]) {
  const active = {
    execute: jest.fn().mockResolvedValue(planoView),
  } as unknown as jest.Mocked<GetActiveRoutePlanUseCase>;
  const pedidos: string[][] = [];
  const gateway = {
    getStops: jest.fn(),
    getOwnership: jest.fn(),
    listActiveStops: jest.fn(),
    getRouteStops: jest.fn(async (_t: string, ids: string[]) => {
      pedidos.push(ids);
      return entregas.filter((e) => ids.includes(e.id));
    }),
  } as unknown as DeliveryGatewayPort;
  return { uc: new GetCurrentRouteUseCase(active, gateway), active, pedidos };
}

describe('GetCurrentRouteUseCase', () => {
  it('sem rota do dia, devolve nulo', async () => {
    const { uc } = build(null, []);

    expect(await uc.execute(TENANT, LOGIN)).toBeNull();
  });

  it('junta morada, estado e prioridade a cada parada', async () => {
    const { uc } = build(plano(['a', 'b']), [entrega('a'), entrega('b', { priority: 'urgent' })]);

    const rota = (await uc.execute(TENANT, LOGIN))!;

    expect(rota.stops[0]).toMatchObject({
      deliveryId: 'a',
      addressText: 'Rua a',
      status: 'pending',
    });
    expect(rota.stops[1].priority).toBe('urgent');
  });

  // O ponto da tarefa: as entregas vêm **pelos ids do plano**, nunca por página.
  it('pede exatamente os ids do plano, sem paginar nem ordenar', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `d${i}`);
    const { uc, pedidos } = build(
      plano(ids),
      ids.map((id) => entrega(id)),
    );

    const rota = (await uc.execute(TENANT, LOGIN))!;

    expect(pedidos[0]).toHaveLength(250);
    expect(rota.stops).toHaveLength(250);
    expect(rota.stops.every((s) => s.addressText !== null)).toBe(true);
  });

  it('funciona com mais de 100 entregas — nenhuma parada fica sem morada', async () => {
    const ids = Array.from({ length: 137 }, (_, i) => `d${i}`);
    const { uc } = build(
      plano(ids),
      ids.map((id) => entrega(id)),
    );

    const rota = (await uc.execute(TENANT, LOGIN))!;

    expect(rota.stops.filter((s) => s.addressText === null)).toHaveLength(0);
    expect(rota.progress.total).toBe(137);
  });

  it('a ordem do plano é preservada', async () => {
    const { uc } = build(plano(['c', 'a', 'b']), [entrega('a'), entrega('b'), entrega('c')]);

    const rota = (await uc.execute(TENANT, LOGIN))!;

    expect(rota.stops.map((s) => s.deliveryId)).toEqual(['c', 'a', 'b']);
    expect(rota.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
  });

  describe('progresso derivado no servidor', () => {
    it('conta concluídas, falhadas e pendentes', async () => {
      const { uc } = build(plano(['a', 'b', 'c', 'd']), [
        entrega('a', { status: 'delivered' }),
        entrega('b', { status: 'failed' }),
        entrega('c'),
        entrega('d'),
      ]);

      const { progress } = (await uc.execute(TENANT, LOGIN))!;

      expect(progress).toMatchObject({ total: 4, completed: 1, failed: 1, pending: 2 });
    });

    // A próxima é a primeira **na ordem do plano** que ainda não terminou.
    it('a próxima parada salta as já terminadas', async () => {
      const { uc } = build(plano(['a', 'b', 'c']), [
        entrega('a', { status: 'delivered' }),
        entrega('b', { status: 'failed' }),
        entrega('c'),
      ]);

      expect((await uc.execute(TENANT, LOGIN))!.progress.nextDeliveryId).toBe('c');
    });

    it('rota inteira terminada não tem próxima', async () => {
      const { uc } = build(plano(['a']), [entrega('a', { status: 'delivered' })]);

      expect((await uc.execute(TENANT, LOGIN))!.progress.nextDeliveryId).toBeNull();
    });
  });

  describe('paradas sem localização', () => {
    // Zero apontaria para o golfo da Guiné; `null` diz que não se sabe.
    it('coordenada ausente vira nula e é contada', async () => {
      const { uc } = build(plano(['a', 'b']), [
        entrega('a'),
        entrega('b', { latitude: null, longitude: null }),
      ]);

      const rota = (await uc.execute(TENANT, LOGIN))!;

      expect(rota.stops[1]).toMatchObject({ latitude: null, longitude: null, hasLocation: false });
      expect(rota.progress.withoutLocation).toBe(1);
    });

    // A entrega pode ter sido apagada depois de a rota ser calculada. A parada
    // fica, porque sumir com ela mudaria a numeração que o motorista já viu.
    it('entrega que sumiu mantém a parada, sem inventar morada nem estado', async () => {
      const { uc } = build(plano(['a', 'fantasma']), [entrega('a')]);

      const rota = (await uc.execute(TENANT, LOGIN))!;

      expect(rota.stops[1]).toMatchObject({
        deliveryId: 'fantasma',
        addressText: null,
        status: 'unknown',
        hasLocation: false,
      });
      expect(rota.stops).toHaveLength(2);
    });
  });

  // Não há parâmetro de motorista: quem pergunta é quem recebe (ADR-0099).
  it('o sujeito vem do login autenticado', async () => {
    const { uc, active } = build(plano(['a']), [entrega('a')]);

    await uc.execute(TENANT, LOGIN);

    expect(active.execute).toHaveBeenCalledWith(TENANT, LOGIN, expect.any(Date));
  });
});
