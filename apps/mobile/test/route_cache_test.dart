import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/data/route_cache.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';

/// Cache em memória com a mesma forma do real — sem tocar no armazenamento
/// seguro, que não existe num teste de unidade.
class _MemoryCache implements RouteCache {
  Map<String, dynamic>? guardado;
  int escritas = 0;

  @override
  Future<void> save(Map<String, dynamic> payload) async {
    guardado = payload;
    escritas += 1;
  }

  @override
  Future<Map<String, dynamic>?> read() async => guardado;

  @override
  Future<void> clear() async => guardado = null;
}

Map<String, dynamic> planoDe({bool mapEnabled = true}) => {
      'id': 'p1',
      'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
      'savings': {'distanceKm': 1, 'distancePct': 10},
      'mapEnabled': mapEnabled,
      'stops': [
        {
          'sequence': 1,
          'deliveryId': 'd1',
          'etaMinutes': 10,
          'addressText': 'Rua A, 10',
          'status': 'pending',
          'priority': 'normal',
          'hasLocation': true,
          'latitude': 38.72,
          'longitude': -9.14,
        },
        {
          'sequence': 2,
          'deliveryId': 'd2',
          'etaMinutes': 25,
          'addressText': 'Rua B, 20',
          'status': 'pending',
          'priority': 'normal',
          'hasLocation': true,
          'latitude': 38.73,
          'longitude': -9.15,
        },
      ],
      'progress': {
        'total': 2,
        'completed': 0,
        'failed': 0,
        'pending': 2,
        'nextDeliveryId': 'd1',
        'withoutLocation': 0,
      },
    };

/// Interceptor que responde com o plano, ou falha como se não houvesse rede.
class _Api extends Interceptor {
  _Api({required this.plano});

  bool offline = false;
  Map<String, dynamic>? plano;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (offline) {
      handler.reject(
        DioException(
            requestOptions: options, type: DioExceptionType.connectionError),
        true,
      );
      return;
    }
    final body = options.path.contains('route-plans')
        ? {'data': plano}
        : {'data': <Map<String, dynamic>>[]};
    handler.resolve(
        Response(requestOptions: options, statusCode: 200, data: body));
  }
}

({MyRouteRepository repo, _MemoryCache cache, _Api api}) montar({
  Map<String, dynamic>? plano,
}) {
  final api = _Api(plano: plano ?? planoDe());
  final cache = _MemoryCache();
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
    ..interceptors.add(api);
  return (repo: MyRouteRepository(dio, cache), cache: cache, api: api);
}

void main() {
  group('instantâneo guardado', () {
    test('uma leitura com sucesso guarda a rota', () async {
      final m = montar();

      await m.repo.load();
      // A escrita é `unawaited` de propósito (não bloqueia a tela); uma volta
      // ao event loop chega para ela acontecer.
      await Future<void>.delayed(Duration.zero);

      expect(m.cache.escritas, 1);
      expect(m.cache.guardado?['id'], 'p1');
    });

    test('sem rede, a rota guardada aparece em vez de um erro', () async {
      // Critério de aceite: a app continua operacional sem internet.
      final m = montar();
      await m.repo.load();
      await Future<void>.delayed(Duration.zero);
      m.api.offline = true;

      final rota = await m.repo.load();

      expect(rota.status, MyRouteStatus.ready);
      expect(rota.stops.map((s) => s.deliveryId), ['d1', 'd2']);
      expect(rota.next?.id, 'd1');
    });

    test('a rota do cache diz que veio do cache', () async {
      // Uma rota desatualizada apresentada como atual é pior do que um erro.
      final m = montar();
      await m.repo.load();
      await Future<void>.delayed(Duration.zero);
      m.api.offline = true;

      expect((await m.repo.load()).fromCache, isTrue);
    });

    test('a rota do servidor não se diz do cache', () async {
      expect((await montar().repo.load()).fromCache, isFalse);
    });

    test('sem rede e sem nada guardado, o erro sobe', () async {
      // Não há o que mostrar, e inventar uma rota vazia faria parecer que o
      // dia não tem entregas.
      final m = montar();
      m.api.offline = true;

      await expectLater(m.repo.load(), throwsA(isA<Object>()));
    });

    test('uma resposta sem plano não apaga a rota guardada', () async {
      // Gravar o `null` de quem ainda não tem plano do dia apagaria a rota de
      // ontem sem nada em troca.
      final m = montar();
      await m.repo.load();
      await Future<void>.delayed(Duration.zero);
      m.api.plano = null;

      await m.repo.load();

      expect(m.cache.guardado?['id'], 'p1');
    });

    test('um instantâneo ilegível não impede a app de abrir', () async {
      final m = montar();
      m.cache.guardado = {'stops': 'isto não é uma lista'};
      m.api.offline = true;

      await expectLater(m.repo.load(), throwsA(isA<Object>()));
    });
  });

  group('piloto do mapa', () {
    test('o campo do servidor é respeitado', () async {
      final m = montar(plano: planoDe(mapEnabled: false));

      expect((await m.repo.load()).mapEnabled, isFalse);
    });

    test('resposta sem o campo mantém o mapa ligado', () async {
      // Retrocompatibilidade: um servidor anterior ao piloto não manda o campo,
      // e naquela altura o mapa já aparecia. Desligar por omissão faria uma app
      // nova esconder o mapa contra um servidor antigo.
      final plano = planoDe()..remove('mapEnabled');
      final m = montar(plano: plano);

      expect((await m.repo.load()).mapEnabled, isTrue);
    });
  });
}
