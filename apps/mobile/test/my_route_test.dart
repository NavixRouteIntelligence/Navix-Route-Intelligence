import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';

/// Interceptor que responde às duas chamadas do repositório sem rede.
class _FakeApi extends Interceptor {
  _FakeApi({required this.plans, required this.deliveries});

  final List<Map<String, dynamic>> plans;
  final List<Map<String, dynamic>> deliveries;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final body = options.path.contains('route-plans') ? {'data': plans} : {'data': deliveries};
    handler.resolve(Response(requestOptions: options, statusCode: 200, data: body));
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
      handler.resolve(Response(requestOptions: options, statusCode: 202, data: {
        'data': {'jobId': 'job-1'}
      }));
    } else if (options.path.contains('/jobs/')) {
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: {
        'data': {'status': jobStatus, 'routePlanId': 'p1'}
      }));
    } else {
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: {'data': []}));
    }
  }
}

MyRouteRepository repo({
  List<Map<String, dynamic>> plans = const [],
  List<Map<String, dynamic>> deliveries = const [],
}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
    ..httpClientAdapter = IOHttpClientAdapter()
    ..interceptors.add(_FakeApi(plans: plans, deliveries: deliveries));
  return MyRouteRepository(dio);
}

Map<String, dynamic> delivery(String id, String street) => {
      'id': id,
      'address': {'street': street, 'number': '10', 'city': 'Lisboa', 'state': 'LX'},
    };

void main() {
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

  test('com plano: lê resumo, grupos e paradas com endereço resolvido', () async {
    final route = await repo(
      plans: [
        {
          'id': 'p1',
          'createdAt': '2026-07-23T09:00:00.000Z',
          'metrics': {'totalDistanceKm': 12.5, 'totalTimeMinutes': 95},
          'savings': {'distanceKm': 3.2, 'distancePct': 20},
          'stops': [
            {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 12},
            {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 40},
          ],
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
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B')],
    ).load();

    expect(route.status, MyRouteStatus.ready);
    expect(route.isReady, isTrue);
    expect(route.totalStops, 2);
    expect(route.distanceKm, 12.5);
    expect(route.savedKm, 3.2);
    expect(route.updatedAt, isNotNull);
    expect(route.groups.map((g) => g.type), ['commerce', 'residence']);
    expect(route.stops.first.addressLine, 'Rua A, 10');
    expect(route.stops.first.cityLine, 'Lisboa — LX');
  });

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
      deliveries: [delivery('d1', 'Rua A'), delivery('d2', 'Rua B'), delivery('d3', 'Rua C')],
    ).load();

    final stops = route.stopsOf(route.groups.first);

    expect(stops.map((s) => s.sequence), [1, 3]);
  });

  group('reorganize', () {
    // Interceptor que grava os POST /mine e resolve o job na 1ª consulta.
    test('IA enfileira com smart:true e aguarda o job concluir', () async {
      final calls = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
        ..httpClientAdapter = IOHttpClientAdapter()
        ..interceptors.add(_ReorgApi(calls, jobStatus: 'succeeded'));

      await MyRouteRepository(dio).reorganize(ReorganizeMode.ai, order: ['d1', 'd2']);

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

      await MyRouteRepository(dio).reorganize(ReorganizeMode.manual, order: ['d2', 'd1']);

      final post = calls.firstWhere((c) => c.method == 'POST');
      expect((post.data as Map)['strategy'], 'manual');
      expect((post.data as Map)['deliveryIds'], ['d2', 'd1']);
    });

    test('job falhado vira erro', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
        ..httpClientAdapter = IOHttpClientAdapter()
        ..interceptors.add(_ReorgApi(<RequestOptions>[], jobStatus: 'failed'));

      expect(
        () => MyRouteRepository(dio).reorganize(ReorganizeMode.ai, order: ['d1', 'd2']),
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
}
