import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';

/// Interceptor que responde às duas chamadas do repositório sem rede.
class _FakeApi extends Interceptor {
  _FakeApi({
    required this.plans,
    required this.deliveries,
    this.paths,
    this.comoLista = false,
  });

  /// Responde `/route-plans` com o formato **antigo** (lista de planos).
  final bool comoLista;

  /// Caminhos chamados, quando o teste quiser inspecioná-los.
  final List<String>? paths;

  final List<Map<String, dynamic>> plans;
  final List<Map<String, dynamic>> deliveries;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    paths?.add(options.path);
    // `/route-plans/mine/current` devolve **um** plano (ou null), não uma lista
    // — a rota vigente já vem resolvida para o motorista (ADR-0098).
    final body = options.path.contains('route-plans')
        ? {'data': comoLista ? plans : (plans.isEmpty ? null : plans.first)}
        : {'data': deliveries};
    handler.resolve(
      Response(requestOptions: options, statusCode: 200, data: body),
    );
  }
}

/// Interceptor para os testes de reorganize: grava as chamadas, responde 202 +
/// jobId ao POST e devolve o status pedido ao consultar o job.
class _ReorgApi extends Interceptor {
  _ReorgApi(this.calls, {required this.jobStatus});

  final List<RequestOptions> calls;
  final String jobStatus;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    calls.add(options);
    if (options.method == 'POST') {
      handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 202,
          data: {
            'data': {'jobId': 'job-1'},
          },
        ),
      );
    } else if (options.path.contains('/jobs/')) {
      handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'data': {'status': jobStatus, 'routePlanId': 'p1'},
          },
        ),
      );
    } else {
      handler.resolve(
        Response(requestOptions: options, statusCode: 200, data: {'data': []}),
      );
    }
  }
}

MyRouteRepository repo({
  List<Map<String, dynamic>> plans = const [],
  List<Map<String, dynamic>> deliveries = const [],
  List<String>? paths,
  bool comoLista = false,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
    ..httpClientAdapter = IOHttpClientAdapter()
    ..interceptors.add(
      _FakeApi(
        plans: plans,
        deliveries: deliveries,
        paths: paths,
        comoLista: comoLista,
      ),
    );
  return MyRouteRepository(dio);
}

Map<String, dynamic> delivery(
  String id,
  String street, {
  String status = 'pending',
}) =>
    {
      'id': id,
      'status': status,
      'address': {
        'street': street,
        'number': '10',
        'city': 'Lisboa',
        'state': 'LX',
      },
    };

void main() {
  // Guarda de regressão do defeito que a ADR-0098 conserta: enquanto a rota
  // vinha de `/route-plans?pageSize=1`, o app mostrava o plano mais recente do
  // **tenant** — numa frota, a rota de outro motorista.
  test('a rota vem do endpoint do próprio motorista', () async {
    final paths = <String>[];

    await repo(deliveries: [delivery('d1', 'Rua A')], paths: paths).load();

    expect(paths, contains('/route-plans/mine/current'));
    expect(paths.any((p) => p.startsWith('/route-plans?')), isFalse);
  });

  // NAV-4.3 / ADR-0102: o app não pode voltar a aceitar o formato global. Uma
  // lista de planos do tenant é exatamente o que ele lia antes, e o mais
  // recente ali é a rota de algum motorista — quase nunca a de quem abriu a
  // tela. Aceitar o formato antigo em silêncio é o que faria a regressão passar
  // despercebida.
  test('resposta em lista (contrato antigo) não vira rota', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p-de-outro',
          'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
          'savings': {'distanceKm': 2, 'distancePct': 17},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 20},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 45},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
      comoLista: true,
    ).load();

    expect(route.status, isNot(MyRouteStatus.ready));
    expect(route.totalStops, 0);
  });

  // Quem pergunta é quem recebe: o app não manda id de motorista nenhum, então
  // não existe cliente capaz de pedir a rota de outra pessoa.
  test('a rota é pedida sem qualquer parâmetro de motorista', () async {
    final paths = <String>[];

    await repo(deliveries: [delivery('d1', 'Rua A')], paths: paths).load();

    final rota = paths.firstWhere((p) => p.contains('route-plans'));
    expect(rota, '/route-plans/mine/current');
    expect(rota, isNot(contains('driver')));
    expect(rota, isNot(contains('?')));
  });

  // NAV-4.4 / ADR-0103: recarregar a tela tem de mostrar a ordem que o
  // motorista deixou — não a ordem natural das entregas. É o recarregamento que
  // desfazia a reordenação antes de a ordem ser preservada de ponta a ponta.
  test('ao recarregar, a rota vem na ordem manual persistida', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'strategy': 'manual',
          'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          // O backend devolve a sequência persistida: d2 antes de d1.
          'stops': [
            {'sequence': 1, 'deliveryId': 'd2', 'etaMinutes': 20},
            {'sequence': 2, 'deliveryId': 'd1', 'etaMinutes': 45},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.status, MyRouteStatus.ready);
    expect(route.stops.map((s) => s.deliveryId).toList(), ['d2', 'd1']);
    // O app não reordena por conta própria: a posição vem do plano.
    expect(route.stops.map((s) => s.sequence).toList(), [1, 2]);
  });

  test('sem plano e sem entregas suficientes: rota vazia', () async {
    final route = await repo(deliveries: [delivery('d1', 'Rua A')]).load();

    expect(route.status, MyRouteStatus.empty);
  });

  test('sem plano mas com entregas: a IA ainda está preparando', () async {
    final route = await repo(
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    // Distinguir isto de "vazio" muda a mensagem que o motorista vê.
    expect(route.status, MyRouteStatus.preparing);
  });

  test(
    'com plano: lê resumo, grupos e paradas com endereço resolvido',
    () async {
      final route = await repo(
        plans: [
          {
            'id': 'p1',
            'createdAt': '2026-07-23T09:00:00.000Z',
            'metrics': {'totalDistanceKm': 12.5, 'totalTimeMinutes': 95},
            'baseline': {'totalDistanceKm': 15.7, 'totalTimeMinutes': 120},
            'savings': {
              'distanceKm': 3.2,
              'distancePct': 20,
              'timeMinutes': 25,
              'timePct': 20.8,
            },
            'params': {'vehicleType': 'van'},
            // Forma de `/route-plans/mine/current` (ADR-0127): a morada, o
            // estado e a prioridade vêm **na parada**, e o progresso vem
            // derivado do servidor.
            'stops': [
              {
                'sequence': 1,
                'deliveryId': 'd1',
                'etaMinutes': 12,
                'addressText': 'Rua A, 10 — Lisboa — LX',
                'status': 'delivered',
                'priority': 'normal',
                'hasLocation': true,
                'latitude': 38.7223,
                'longitude': -9.1393,
              },
              {
                'sequence': 2,
                'deliveryId': 'd2',
                'etaMinutes': 40,
                'addressText': 'Rua B, 20 — Lisboa — LX',
                'status': 'pending',
                'priority': 'urgent',
                'hasLocation': true,
                'latitude': 38.7369,
                'longitude': -9.1427,
              },
            ],
            'progress': {
              'total': 2,
              'completed': 1,
              'failed': 0,
              'pending': 1,
              'nextDeliveryId': 'd2',
              'withoutLocation': 0,
            },
            // Traçado real (ADR-0131), quando o servidor o conseguiu.
            'geometry': {
              'coordinates': [
                [-9.1393, 38.7223],
                [-9.1421, 38.724],
              ],
              'provenance': {
                'source': 'directions',
                'profile': 'driving',
                'coveredStops': 2,
                'totalStops': 2,
              },
            },
            'groups': [
              {
                'type': 'commerce',
                'order': 1,
                'stops': 1,
                'sequences': [1],
                'distanceKm': 5.0,
                'timeMinutes': 12,
              },
              {
                'type': 'residence',
                'order': 2,
                'stops': 1,
                'sequences': [2],
                'distanceKm': 7.5,
                'timeMinutes': 28,
              },
            ],
          },
        ],
        deliveries: [
          delivery('d1', 'Rua A', status: 'delivered'),
          delivery('d2', 'Rua B'),
        ],
      ).load();

      expect(route.status, MyRouteStatus.ready);
      expect(route.isReady, isTrue);
      expect(route.totalStops, 2);
      expect(route.completedStops, 1);
      expect(route.remainingStops, 1);
      expect(route.completionRatio, 0.5);
      expect(route.distanceKm, 12.5);
      expect(route.savedKm, 3.2);
      expect(route.savedMinutes, 25);
      expect(route.baselineDistanceKm, 15.7);
      expect(route.baselineTimeMinutes, 120);
      expect(route.vehicleType, 'van');
      expect(route.usesDefaultFuelEstimate, isFalse);
      expect(route.fuelSavedLiters, closeTo(0.352, 0.0001));
      expect(route.updatedAt, isNotNull);
      expect(route.groups.map((g) => g.type), ['commerce', 'residence']);
      // A morada chega numa linha só, composta no servidor. O `cityLine`
      // deixou de ser preenchido pelo app — ele já não cruza entregas para
      // montar endereços (ADR-0130).
      expect(route.stops.first.addressLine, 'Rua A, 10 — Lisboa — LX');
      expect(route.stops.first.cityLine, isEmpty);
      expect(route.stops.first.hasNavigableCoordinates, isTrue);
      expect(route.stops.first.latitude, 38.7223);
      // Estado e prioridade por parada, que o mapa e a folha de detalhe usam.
      expect(route.stops.first.status, 'delivered');
      expect(route.stops.first.isDone, isTrue);
      expect(route.stops.last.priority, 'urgent');
      // A próxima parada é a que o **servidor** apontou, não uma que o app
      // recalculou.
      expect(route.next?.id, 'd2');
      // O traçado vem junto e não é parcial.
      expect(route.line?.coordinates, hasLength(2));
      expect(route.line?.isPartial, isFalse);
    },
  );

  test('stopsOf devolve só as paradas do grupo, em ordem de rota', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'metrics': {'totalDistanceKm': 1, 'totalTimeMinutes': 1},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 3, 'deliveryId': 'd3', 'etaMinutes': 30},
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 10},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 20},
          ],
          'groups': [
            {
              'type': 'residence',
              'order': 1,
              'stops': 2,
              'sequences': [1, 3],
              'distanceKm': 1,
              'timeMinutes': 1,
            },
          ],
        },
      ],
      deliveries: [
        delivery('d1', 'Rua A'),
        delivery('d2', 'Rua B'),
        delivery('d3', 'Rua C'),
      ],
    ).load();

    final stops = route.stopsOf(route.groups.first);

    expect(stops.map((s) => s.sequence), [1, 3]);
  });

  test('rota sem traçado carrega na mesma', () async {
    // O critério de aceite: geometria indisponível nunca impede carregar a
    // rota. Os planos das outras fixtures não trazem `geometry` — este teste
    // afirma que essa ausência é normal, e não um erro por tratar.
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'metrics': {'totalDistanceKm': 1, 'totalTimeMinutes': 1},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 10},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 20},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.status, MyRouteStatus.ready);
    expect(route.stops, hasLength(2));
    expect(route.line, isNull);
  });

  test('traçado corrompido não contamina a rota', () async {
    // Uma coordenada fora do planeta faria a câmara enquadrar meio globo.
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'metrics': {'totalDistanceKm': 1, 'totalTimeMinutes': 1},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 10},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 20},
          ],
          'geometry': {
            'coordinates': [
              [-9.13, 38.72],
              [-9.14, 999.0],
            ],
          },
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.status, MyRouteStatus.ready);
    expect(route.line, isNull);
  });

  group('reorganize', () {
    // Interceptor que grava os POST /mine e resolve o job na 1ª consulta.
    test('IA enfileira com smart:true e aguarda o job concluir', () async {
      final calls = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
        ..httpClientAdapter = IOHttpClientAdapter()
        ..interceptors.add(_ReorgApi(calls, jobStatus: 'succeeded'));

      await MyRouteRepository(
        dio,
      ).reorganize(ReorganizeMode.ai, order: ['d1', 'd2']);

      final post = calls.firstWhere((c) => c.method == 'POST');
      expect(post.path, contains('/route-plans/mine'));
      expect((post.data as Map)['smart'], true);
      expect((post.data as Map)['deliveryIds'], ['d1', 'd2']);
      expect(calls.any((c) => c.path.contains('/jobs/')), isTrue);
    });

    test('Manual enfileira com strategy:manual e a ordem escolhida', () async {
      final calls = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
        ..httpClientAdapter = IOHttpClientAdapter()
        ..interceptors.add(_ReorgApi(calls, jobStatus: 'succeeded'));

      await MyRouteRepository(
        dio,
      ).reorganize(ReorganizeMode.manual, order: ['d2', 'd1']);

      final post = calls.firstWhere((c) => c.method == 'POST');
      expect((post.data as Map)['strategy'], 'manual');
      expect((post.data as Map)['deliveryIds'], ['d2', 'd1']);
    });

    test('job falhado vira erro', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
        ..httpClientAdapter = IOHttpClientAdapter()
        ..interceptors.add(_ReorgApi(<RequestOptions>[], jobStatus: 'failed'));

      expect(
        () => MyRouteRepository(
          dio,
        ).reorganize(ReorganizeMode.ai, order: ['d1', 'd2']),
        throwsA(anything),
      );
    });
  });

  test('plano sem grupos (backend antigo) não quebra', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'metrics': {'totalDistanceKm': 5, 'totalTimeMinutes': 30},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 10},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A')],
    ).load();

    expect(route.isReady, isTrue);
    expect(route.groups, isEmpty);
  });

  // NAV-4.11 / ADR-0110: o app precisa distinguir rota completa de parcial, e
  // o motorista precisa saber antes de sair.
  test('rota completa não tem entregas fora', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'status': 'completed',
          'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 20},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 45},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.isPartial, isFalse);
    expect(route.unassigned, isEmpty);
  });

  test('rota parcial traz as entregas de fora com o motivo', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'status': 'partial',
          'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 20},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 45},
          ],
          'unassignedStops': [
            {'deliveryId': 'd9', 'reason': 'capacity'},
            {'deliveryId': 'd8', 'reason': 'isolated'},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.isPartial, isTrue);
    expect(route.unassigned.map((u) => u.deliveryId).toList(), ['d9', 'd8']);
    expect(route.unassigned.map((u) => u.reason).toList(),
        ['capacity', 'isolated']);
    // A rota em si continua utilizável: parcial não é falha.
    expect(route.status, MyRouteStatus.ready);
  });

  // Contrato antigo (sem o campo) não pode virar rota "parcial" por engano.
  test('plano sem o campo é tratado como completo', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
          'savings': {'distanceKm': 0, 'distancePct': 0},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 20},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 45},
          ],
        },
      ],
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.isPartial, isFalse);
  });
}
