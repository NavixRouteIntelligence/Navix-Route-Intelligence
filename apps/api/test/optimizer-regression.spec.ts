import { EnqueueOptimizationUseCase } from '../src/modules/optimizer/application/enqueue-optimization.use-case';
import type { DeliveryGatewayPort } from '../src/modules/optimizer/application/ports/delivery-gateway.port';
import type { OptimizationJobRepositoryPort } from '../src/modules/optimizer/domain/ports/optimization-job-repository.port';
import { RoutePlan } from '../src/modules/optimizer/domain/route-plan';
import { UNREACHABLE } from '../src/modules/optimizer/domain/reachability';

import {
  FICHA,
  PONTOS,
  RecordedRoutingProvider,
  STOP,
  TENANT,
  comandoDoMotorista,
  linhaComPontoIsolado,
  linhaComTrechoProibido,
  matrizDaLinha,
  montarOtimizador,
  paradas,
} from './fixtures/optimizer-scenarios';

/**
 * Suíte de regressão do otimizador (ADR-0115).
 *
 * Um cenário por comportamento que **já quebrou** — cada `describe` nomeia a ADR
 * que o estabeleceu. Não substitui os testes unitários daquelas mudanças: eles
 * verificam a peça, esta verifica a **composição**, com o solver e as estratégias
 * de verdade e uma matriz declarada no lugar do provedor externo.
 *
 * Quando um destes falha, a resposta útil não é "um teste quebrou" e sim "a
 * rota do motorista voltou a ser substituída por um job antigo" — por isso os
 * nomes descrevem o defeito, não a função.
 */
describe('Regressão do otimizador', () => {
  // ADR-0098/0099/0113: a rota é de um motorista, e só dele.
  describe('isolamento por motorista', () => {
    it('a rota nasce carimbada com a ficha de quem pediu', async () => {
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista());

      expect(gravados[0].snapshot().driverId).toBe(FICHA);
      expect(gravados[0].snapshot().driverScoped).toBe(true);
    });

    it('o plano do despacho não é rota de motorista nenhum', async () => {
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista({ driverId: null, driverScoped: false }));

      expect(gravados[0].snapshot().driverScoped).toBe(false);
    });

    // O autônomo não tem ficha (ADR-0085), e isso não pode virar "sem dono".
    it('motorista autônomo produz rota com ficha nula, ainda assim dele', async () => {
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista({ driverId: null }));

      expect(gravados[0].snapshot().driverId).toBeNull();
      expect(gravados[0].snapshot().driverScoped).toBe(true);
    });
  });

  // ADR-0062/0103: a ordem que a pessoa arrastou é a ordem que fica.
  describe('ordem manual', () => {
    it('a sequência enviada é a persistida, numerada', async () => {
      const { uc } = montarOtimizador();
      const escolhida = [paradas()[2], paradas()[0], paradas()[1]];

      const view = await uc.execute(comandoDoMotorista({ strategy: 'manual', stops: escolhida }));

      expect(view.stops.map((s) => s.deliveryId)).toEqual([STOP.C, STOP.A, STOP.B]);
      expect(view.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
    });

    it('a otimização normal reordena — a manual é que não', async () => {
      const { uc } = montarOtimizador();
      const foraDeOrdem = [paradas()[3], paradas()[0], paradas()[2], paradas()[1]];

      const auto = await uc.execute(comandoDoMotorista({ stops: foraDeOrdem }));

      // Na linha de 4 pontos, a rota mais curta a partir de D é D→C→B→A.
      expect(auto.stops.map((s) => s.deliveryId)).not.toEqual(foraDeOrdem.map((s) => s.id));
      expect(auto.metrics.totalDistanceKm).toBe(3);
    });

    it('um job pedido antes não desfaz a ordem pedida depois', async () => {
      const manual = RoutePlan.create({
        tenantId: TENANT,
        driverId: FICHA,
        driverScoped: true,
        requestedAt: new Date('2026-08-08T10:05:00Z'),
        version: 2,
        strategy: 'manual',
        params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
        stops: [],
        metrics: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
        baseline: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
        savings: { distanceKm: 0, distancePct: 0, timeMinutes: 0, timePct: 0 },
        score: 1,
        explanation: 'manual',
      });
      const { uc, gravados } = montarOtimizador({ vigente: manual });

      const view = await uc.execute(
        comandoDoMotorista({ requestedAt: new Date('2026-08-08T10:00:00Z') }),
      );

      expect(gravados).toHaveLength(0);
      expect(view.id).toBe(manual.id);
    });
  });

  // ADR-0104/0105: janela é restrição, espera é tempo, e o relógio começa na partida.
  describe('janelas horárias e horário real', () => {
    const PARTIDA = new Date('2026-08-08T08:00:00.000Z');

    it('chegar antes da abertura vira espera, não desrespeito', async () => {
      const comJanela = paradas(2, [
        {},
        { timeWindow: { start: '2026-08-08T09:00:00.000Z', end: '2026-08-08T18:00:00.000Z' } },
      ]);
      const { uc } = montarOtimizador();

      const view = await uc.execute(
        comandoDoMotorista({ stops: comJanela, startAt: PARTIDA, serviceTimeMinutes: 0 }),
      );

      const segunda = view.stops[1];
      expect(segunda.timeWindowRespected).toBe(true);
      // Chega em 2 min e a janela abre em 60: espera 58, e não é atraso.
      expect(segunda.etaMinutes).toBe(2);
      expect(segunda.waitMinutes).toBe(58);
    });

    it('atraso de verdade é começar depois do fim da janela', async () => {
      const janelaFechada = paradas(2, [
        {},
        { timeWindow: { start: '2026-08-08T07:00:00.000Z', end: '2026-08-08T07:30:00.000Z' } },
      ]);
      const { uc } = montarOtimizador();

      const view = await uc.execute(
        comandoDoMotorista({ stops: janelaFechada, startAt: PARTIDA, serviceTimeMinutes: 0 }),
      );

      expect(view.stops[1].timeWindowRespected).toBe(false);
    });

    it('o minuto zero é a partida informada, não o instante do cálculo', async () => {
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista({ startAt: PARTIDA }));

      expect(gravados[0].snapshot().departureAt.toISOString()).toBe(PARTIDA.toISOString());
    });

    it('a espera entra no tempo total da rota', async () => {
      const comJanela = paradas(2, [
        {},
        { timeWindow: { start: '2026-08-08T09:00:00.000Z', end: '2026-08-08T18:00:00.000Z' } },
      ]);
      const { uc } = montarOtimizador();

      const view = await uc.execute(
        comandoDoMotorista({ stops: comJanela, startAt: PARTIDA, serviceTimeMinutes: 0 }),
      );

      expect(view.metrics.totalWaitMinutes).toBe(58);
      expect(view.metrics.totalTimeMinutes).toBeGreaterThanOrEqual(58);
    });
  });

  // ADR-0106: sem rota possível é proibido, nunca custo zero.
  describe('pontos inalcançáveis', () => {
    it('trecho sem rota não vira a aresta mais barata do grafo', async () => {
      const { uc } = montarOtimizador({ routing: linhaComTrechoProibido([0, 1]) });

      const view = await uc.execute(comandoDoMotorista());

      // A rota existe, e nenhuma perna usa o trecho proibido.
      const pernas = view.stops.map((s) => s.legDistanceKm);
      expect(pernas.every((p) => Number.isFinite(p))).toBe(true);
      expect(view.metrics.totalDistanceKm).toBeLessThan(UNREACHABLE);
    });

    it('parada isolada de todas as outras fica fora, com motivo', async () => {
      const { uc, gravados } = montarOtimizador({ routing: linhaComPontoIsolado(3, 4) });

      await uc.execute(comandoDoMotorista());

      const fora = gravados[0].snapshot().unassignedStops ?? [];
      expect(fora).toHaveLength(1);
      expect(fora[0]).toMatchObject({ deliveryId: STOP.D });
      expect(gravados[0].snapshot().status).toBe('partial');
    });
  });

  // ADR-0107: acima de 25 pontos a matriz é montada em ladrilhos.
  describe('mais de 25 pontos', () => {
    it('roteiriza 30 paradas sem cair em geometria', async () => {
      const routing = new RecordedRoutingProvider();
      const { uc } = montarOtimizador({ routing });

      const view = await uc.execute(comandoDoMotorista({ stops: paradas(30) }));

      expect(view.stops).toHaveLength(30);
      expect(view.params.routingSource).toBe('provider');
      // Linha de 30 pontos: a rota ótima percorre 29 km.
      expect(view.metrics.totalDistanceKm).toBe(29);
    });

    it('a origem das distâncias é declarada no plano', async () => {
      const { uc } = montarOtimizador();

      const view = await uc.execute(comandoDoMotorista({ stops: paradas(4) }));

      expect(view.params.routingSource).toBe('provider');
    });
  });

  // ADR-0108: bicicleta não recebe rota de carro.
  describe('perfis de veículo', () => {
    it('o tipo do veículo chega ao provedor', async () => {
      const routing = new RecordedRoutingProvider();
      const { uc } = montarOtimizador({ routing });

      await uc.execute(comandoDoMotorista({ vehicle: { type: 'bicycle' } }));

      expect(routing.calls[0].vehicleType).toBe('bicycle');
    });

    it('o perfil usado fica no plano, para quem lê a rota depois', async () => {
      const routing = new RecordedRoutingProvider();
      const { uc } = montarOtimizador({ routing });

      const view = await uc.execute(comandoDoMotorista({ vehicle: { type: 'bicycle' } }));

      expect(view.params.routingProfile?.profile).toBe('cycling');
    });

    it('sem veículo, o provedor recebe ausência — não um carro presumido', async () => {
      const routing = new RecordedRoutingProvider();
      const { uc } = montarOtimizador({ routing });

      await uc.execute(comandoDoMotorista());

      expect(routing.calls[0].vehicleType ?? null).toBeNull();
    });
  });

  // ADR-0109: peso e volume reais, e ausência declarada em vez de zero mudo.
  describe('capacidade', () => {
    it('excesso de carga vira parada fora da rota, com motivo', async () => {
      // Moto leva 30 kg: cabem duas de 12, e as outras duas ficam.
      const pesadas = paradas(4, [
        { weightKg: 12 },
        { weightKg: 12 },
        { weightKg: 12 },
        { weightKg: 12 },
      ]);
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista({ stops: pesadas, vehicle: { type: 'motorcycle' } }));

      const fora = gravados[0].snapshot().unassignedStops ?? [];
      expect(fora).toHaveLength(2);
      expect(fora.every((f) => f.reason === 'capacity')).toBe(true);
      expect(gravados[0].snapshot().status).toBe('partial');
    });

    // A ressalva da ADR-0109: o motor corta o que não cabe, mas não ao ponto de
    // transformar "não cabe" em "não há rota" — aí volta ao comportamento da
    // ADR-0022, que leva tudo e sinaliza inviável. Escolher qual entrega não
    // acontece hoje é decisão de quem despacha.
    it('quando o corte não deixaria rota, leva tudo e sinaliza inviável', async () => {
      const pesadissimas = paradas(2, [{ weightKg: 20 }, { weightKg: 20 }]);
      const { uc, gravados } = montarOtimizador();

      const view = await uc.execute(
        comandoDoMotorista({ stops: pesadissimas, vehicle: { type: 'motorcycle' } }),
      );

      expect(gravados[0].snapshot().unassignedStops).toBeUndefined();
      expect(view.capacity?.feasible).toBe(false);
      expect(view.stops).toHaveLength(2);
    });

    it('entrega sem peso conta como zero, e o plano diz quantas eram', async () => {
      const { uc } = montarOtimizador();

      const view = await uc.execute(
        comandoDoMotorista({ stops: paradas(4), vehicle: { type: 'van' } }),
      );

      expect(view.params.stopsWithoutDemand).toBe(4);
    });
  });

  // ADR-0110/0113: o desfecho da gravação é visível e disputado no banco.
  describe('plano parcial e concorrência', () => {
    it('rota que atende tudo sai completa, sem lista de exclusões', async () => {
      const { uc, gravados } = montarOtimizador();

      await uc.execute(comandoDoMotorista());

      expect(gravados[0].snapshot().status).toBe('completed');
      expect(gravados[0].snapshot().unassignedStops).toBeUndefined();
    });

    it('perder a versão para outro processo não descarta o pedido mais recente', async () => {
      let versao = 1;
      const feitos: number[] = [];
      const { uc } = montarOtimizador({
        vigente: null,
        plans: {
          findLatestRequestedForDriver: async () =>
            versao === 1 ? null : planoVigente(versao, '2026-08-08T09:00:00Z'),
          save: async (p) => {
            if (versao === 1) {
              versao = 2; // outro processo gravou primeiro
              return 'version-taken';
            }
            feitos.push(p.snapshot().version);
            return 'saved';
          },
        },
      });

      await uc.execute(comandoDoMotorista({ requestedAt: new Date('2026-08-08T10:00:00Z') }));

      expect(feitos).toEqual([3]);
    });

    it('a versão cresce a cada substituição', async () => {
      const { uc, gravados } = montarOtimizador({
        vigente: planoVigente(7, '2026-08-08T09:00:00Z'),
      });

      await uc.execute(comandoDoMotorista({ requestedAt: new Date('2026-08-08T10:00:00Z') }));

      expect(gravados[0].snapshot().version).toBe(8);
    });
  });

  // ADR-0081/0114: a fila é o caminho do trabalho — se ela está fora, o cliente
  // precisa saber agora, não receber 202 e um job que ninguém vai processar.
  describe('indisponibilidade da fila', () => {
    function montarEnfileiramento(enqueue: () => Promise<void>) {
      const criados: string[] = [];
      const jobs = {
        create: async (j: { id: string }) => {
          criados.push(j.id);
        },
        findById: async () => null,
        update: async () => undefined,
        claim: async () => true,
        resetForRetry: async () => false,
      } as unknown as OptimizationJobRepositoryPort;
      const uc = new EnqueueOptimizationUseCase(
        jobs,
        { enqueue },
        {
          getStops: async () => [],
          getOwnership: async () => [],
          listActiveStops: async () => [],
        } as unknown as DeliveryGatewayPort,
        { findTimeZone: async () => 'UTC' },
      );
      return { uc, criados };
    }

    it('com a fila no ar, o pedido é aceito e o job nasce', async () => {
      const { uc, criados } = montarEnfileiramento(async () => undefined);

      const aceito = await uc.execute({ tenantId: TENANT, stops: paradas(2) } as never);

      expect(aceito.status).toBe('queued');
      expect(criados).toHaveLength(1);
    });

    // O 202 mentiroso: antes o erro era só logado, o job ficava `queued` no
    // banco para sempre, invisível, e nem um restart o recuperava.
    it('com a fila fora, a falha sobe em vez de virar um 202 mentiroso', async () => {
      const { uc } = montarEnfileiramento(async () => {
        throw new Error('ECONNREFUSED');
      });

      await expect(uc.execute({ tenantId: TENANT, stops: paradas(2) } as never)).rejects.toThrow(
        /ECONNREFUSED/,
      );
    });

    it('a fila volta e o pedido seguinte é aceito normalmente', async () => {
      let fora = true;
      const { uc, criados } = montarEnfileiramento(async () => {
        if (fora) throw new Error('ECONNREFUSED');
      });

      await expect(uc.execute({ tenantId: TENANT, stops: paradas(2) } as never)).rejects.toThrow();
      fora = false;
      await expect(
        uc.execute({ tenantId: TENANT, stops: paradas(2) } as never),
      ).resolves.toMatchObject({ status: 'queued' });
      expect(criados).toHaveLength(2);
    });
  });

  // O contrato que atravessa todos os cenários: mesmo pedido, mesmo plano.
  describe('determinismo', () => {
    it('o mesmo cenário produz a mesma rota, sem depender de provedor externo', async () => {
      const rodar = async () => {
        const { uc } = montarOtimizador();
        const view = await uc.execute(comandoDoMotorista({ stops: paradas(4) }));
        return {
          ordem: view.stops.map((s) => s.deliveryId),
          km: view.metrics.totalDistanceKm,
          min: view.metrics.totalTimeMinutes,
          score: view.score,
        };
      };

      expect(await rodar()).toEqual(await rodar());
    });

    it('a matriz vem da fixture, não da geografia dos pontos', async () => {
      const routing = new RecordedRoutingProvider((p) => matrizDaLinha(p, { km: 5, min: 10 }));
      const { uc } = montarOtimizador({ routing });

      const view = await uc.execute(comandoDoMotorista({ stops: paradas(4) }));

      // 3 pernas × 5 km — as coordenadas dizem outra coisa, e é a tabela que vale.
      expect(view.metrics.totalDistanceKm).toBe(15);
      expect(PONTOS).toHaveLength(4);
    });
  });
  // ADR-0132: rotas grandes atravessam o ladrilhamento da matriz. O que não
  // pode mudar é o plano que sai dele.
  describe('rotas grandes', () => {
    it('uma parada só não é rota, e recusa-se em vez de fingir', async () => {
      // Regra anterior a esta ADR, incluída aqui porque a T8.8 pede o tamanho 1
      // na suíte: o motor **recusa**, e não devolve um plano de uma parada.
      const { uc } = montarOtimizador({
        routing: new RecordedRoutingProvider((p) => matrizDaLinha(p)),
      });

      await expect(uc.execute(comandoDoMotorista({ stops: paradas(1) }))).rejects.toThrow(
        /ao menos 2 paradas/,
      );
    });

    it.each([2, 10, 25, 26, 50, 100])(
      'com %i paradas, sequência, ETA e distância acumulada saem coerentes',
      async (n) => {
        const stops = paradas(n);
        const { uc, gravados } = montarOtimizador({
          routing: new RecordedRoutingProvider((p) => matrizDaLinha(p)),
        });

        await uc.execute(comandoDoMotorista({ stops }));

        const plano = gravados[0]?.snapshot();
        const sequencias = plano!.stops.map((s) => s.sequence);
        // A sequência é 1..n, sem saltos nem repetições: um ladrilho perdido
        // faria uma parada cair fora e a numeração passaria a mentir sobre
        // quantas entregas há.
        expect(sequencias).toEqual(Array.from({ length: n }, (_, i) => i + 1));

        let distanciaAnterior = -1;
        let etaAnterior = -1;
        for (const parada of plano!.stops) {
          // A distância acumulada nunca decresce — decrescer significaria que
          // uma perna foi contada com sinal trocado ou que a ordem se perdeu.
          expect(parada.cumulativeDistanceKm).toBeGreaterThanOrEqual(distanciaAnterior);
          expect(parada.etaMinutes).toBeGreaterThanOrEqual(etaAnterior);
          expect(Number.isFinite(parada.cumulativeDistanceKm)).toBe(true);
          expect(Number.isFinite(parada.etaMinutes)).toBe(true);
          distanciaAnterior = parada.cumulativeDistanceKm;
          etaAnterior = parada.etaMinutes;
        }

        // A última acumulada é a distância total do plano: são a mesma coisa
        // vista de dois sítios, e discordarem seria o defeito.
        expect(plano!.metrics.totalDistanceKm).toBeCloseTo(distanciaAnterior, 6);
      },
    );

    it('nenhuma parada se perde entre 26 e 100', async () => {
      for (const n of [26, 50, 100]) {
        const stops = paradas(n);
        const { uc, gravados } = montarOtimizador({
          routing: new RecordedRoutingProvider((p) => matrizDaLinha(p)),
        });

        await uc.execute(comandoDoMotorista({ stops }));

        const ids = gravados[0].snapshot().stops.map((s) => s.deliveryId);
        expect(new Set(ids).size).toBe(n);
        expect(new Set(ids)).toEqual(new Set(stops.map((s) => s.id)));
      }
    });
  });
});

/** Rota já gravada do motorista, para os cenários de substituição. */
function planoVigente(version: number, requestedAt: string): RoutePlan {
  return RoutePlan.create({
    tenantId: TENANT,
    driverId: FICHA,
    driverScoped: true,
    requestedAt: new Date(requestedAt),
    version,
    strategy: 'nearest-neighbor-2opt',
    params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
    stops: [],
    metrics: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
    baseline: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
    savings: { distanceKm: 0, distancePct: 0, timeMinutes: 0, timePct: 0 },
    score: 1,
    explanation: 'vigente',
  });
}
