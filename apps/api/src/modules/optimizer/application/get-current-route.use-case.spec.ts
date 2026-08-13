import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { RouteGeometryProviderPort } from '../domain/ports/route-geometry.port';
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

function build(
  planoView: RoutePlanView | null,
  entregas: RouteViewDeliveryStop[],
  geometria: RouteGeometryProviderPort = semTracado,
  rolloutPercent = 100,
) {
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
  return {
    uc: new GetCurrentRouteUseCase(active, gateway, geometria, {
      maps: { rolloutPercent },
    } as AppConfigService),
    active,
    pedidos,
  };
}

/** O caminho por omissão dos testes antigos: sem traçado, tudo o resto igual. */
const semTracado: RouteGeometryProviderPort = { geometry: async () => null };

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
  describe('traçado real (ADR-0131)', () => {
    const comTracado: RouteGeometryProviderPort = {
      geometry: async (points) => ({
        coordinates: [
          [-9.1, 38.7],
          [-9.11, 38.71],
        ],
        profile: 'driving',
        coveredStops: points.length,
      }),
    };

    it('o traçado vai na rota, com a proveniência', async () => {
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], comTracado);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.geometry!.coordinates).toHaveLength(2);
      expect(vista!.geometry!.provenance).toEqual({
        source: 'directions',
        profile: 'driving',
        coveredStops: 2,
        totalStops: 2,
      });
    });

    it('recebe as paradas na ordem do plano', async () => {
      // O traçado é da **sequência decidida**. Recebê-la noutra ordem
      // desenharia um percurso que ninguém vai fazer.
      const recebidos: number[][] = [];
      const espia: RouteGeometryProviderPort = {
        geometry: async (points) => {
          recebidos.push(points.map((p) => p.longitude));
          return null;
        },
      };
      const { uc } = build(
        plano(['d1', 'd2', 'd3']),
        [
          entrega('d1', { longitude: -9.1 }),
          entrega('d2', { longitude: -9.2 }),
          entrega('d3', { longitude: -9.3 }),
        ],
        espia,
      );

      await uc.execute(TENANT, LOGIN);

      expect(recebidos[0]).toEqual([-9.1, -9.2, -9.3]);
    });

    it('sem traçado, a rota carrega à mesma', async () => {
      // O critério de aceite: geometria indisponível nunca impede carregar.
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], semTracado);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.geometry).toBeNull();
      expect(vista!.stops).toHaveLength(2);
      expect(vista!.progress.total).toBe(2);
    });

    it('um provedor que estoura não derruba a rota', async () => {
      const explode: RouteGeometryProviderPort = {
        geometry: async () => {
          throw new Error('provedor fora');
        },
      };
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], explode);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.geometry).toBeNull();
      expect(vista!.stops).toHaveLength(2);
    });

    it('paradas sem localização são saltadas, e a proveniência di-lo', async () => {
      // A linha liga as que têm coordenada e salta as outras: não é o percurso
      // completo, e a tela precisa de o poder dizer.
      const { uc } = build(
        plano(['d1', 'd2', 'd3']),
        [entrega('d1'), entrega('d2', { latitude: null, longitude: null }), entrega('d3')],
        comTracado,
      );

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.geometry!.provenance.coveredStops).toBe(2);
      expect(vista!.geometry!.provenance.totalStops).toBe(3);
    });

    it('menos de duas paradas localizáveis não tem traçado', async () => {
      const { uc } = build(
        plano(['d1', 'd2']),
        [entrega('d1'), entrega('d2', { latitude: null, longitude: null })],
        comTracado,
      );

      expect((await uc.execute(TENANT, LOGIN))!.geometry).toBeNull();
    });

    it('o traçado não mexe nas métricas do plano', async () => {
      // O entregável mais importante: nada do que sai do traçado volta para a
      // otimização. Se a distância da linha entrasse aqui, o número que o
      // motorista lê passaria a depender de uma chamada que pode falhar — e
      // mudaria consoante o traçado tivesse vindo ou não.
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], comTracado);
      const { uc: semLinha } = build(
        plano(['d1', 'd2']),
        [entrega('d1'), entrega('d2')],
        semTracado,
      );

      const com = await uc.execute(TENANT, LOGIN);
      const sem = await semLinha.execute(TENANT, LOGIN);

      expect(com!.metrics).toEqual(sem!.metrics);
      expect(com!.savings).toEqual(sem!.savings);
      expect(com!.progress).toEqual(sem!.progress);
    });
  });

  describe('piloto do mapa (ADR-0134)', () => {
    const comTracado: RouteGeometryProviderPort = {
      geometry: async (points) => ({
        coordinates: [
          [-9.1, 38.7],
          [-9.11, 38.71],
        ],
        profile: 'driving',
        coveredStops: points.length,
      }),
    };

    it('com o piloto fechado, o mapa vem desligado', async () => {
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], comTracado, 0);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.mapEnabled).toBe(false);
    });

    it('com o piloto fechado, não se pede traçado nenhum', async () => {
      // Quem está fora do piloto não pode gerar uma chamada paga à Directions.
      let pedidos = 0;
      const espia: RouteGeometryProviderPort = {
        geometry: async (points) => {
          pedidos += 1;
          return comTracado.geometry(points);
        },
      };
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], espia, 0);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(pedidos).toBe(0);
      expect(vista!.geometry).toBeNull();
    });

    it('com o piloto aberto, o mapa e o traçado vêm', async () => {
      const { uc } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')], comTracado, 100);

      const vista = await uc.execute(TENANT, LOGIN);

      expect(vista!.mapEnabled).toBe(true);
      expect(vista!.geometry).not.toBeNull();
    });

    it('o piloto não altera a rota em si', async () => {
      // O rollback é a garantia inteira desta ADR: com o mapa desligado, a
      // tela volta à lista e **nada** do resto muda.
      const { uc: dentro } = build(
        plano(['d1', 'd2']),
        [entrega('d1'), entrega('d2')],
        comTracado,
        100,
      );
      const { uc: fora } = build(
        plano(['d1', 'd2']),
        [entrega('d1'), entrega('d2')],
        comTracado,
        0,
      );

      const a = await dentro.execute(TENANT, LOGIN);
      const b = await fora.execute(TENANT, LOGIN);

      expect(b!.stops).toEqual(a!.stops);
      expect(b!.progress).toEqual(a!.progress);
      expect(b!.metrics).toEqual(a!.metrics);
    });
  });

  describe('isolamento entre tenants', () => {
    it('o tenant de quem pergunta é o que chega ao plano e às entregas', async () => {
      // Critério de aceite: zero vazamento entre tenants. Não há parâmetro de
      // tenant na rota — ele vem do token —, e este teste guarda que ele
      // atravessa o caso de uso sem ser trocado por outro pelo caminho.
      const { uc, active, pedidos } = build(plano(['d1']), [entrega('d1')]);

      await uc.execute('tenant-A', LOGIN);

      expect(active.execute).toHaveBeenCalledWith('tenant-A', LOGIN, expect.anything());
      expect(pedidos).toHaveLength(1);
    });

    it('sem plano do tenant, não se procuram entregas de ninguém', async () => {
      // Um tenant sem rota do dia não pode disparar uma leitura de entregas —
      // é por aí que uma consulta mal filtrada devolveria as de outro.
      const { uc, pedidos } = build(null, [entrega('d1')]);

      expect(await uc.execute('tenant-B', LOGIN)).toBeNull();
      expect(pedidos).toHaveLength(0);
    });

    it('só se pedem as entregas que o plano refere', async () => {
      const { uc, pedidos } = build(plano(['d1', 'd2']), [entrega('d1'), entrega('d2')]);

      await uc.execute(TENANT, LOGIN);

      expect(pedidos[0]).toEqual(['d1', 'd2']);
    });
  });

  it('o sujeito vem do login autenticado', async () => {
    const { uc, active } = build(plano(['a']), [entrega('a')]);

    await uc.execute(TENANT, LOGIN);

    expect(active.execute).toHaveBeenCalledWith(TENANT, LOGIN, expect.any(Date));
  });
});
