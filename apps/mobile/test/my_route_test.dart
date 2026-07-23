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
