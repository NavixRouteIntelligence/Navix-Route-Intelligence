import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/connectivity/connectivity_service.dart';
import 'package:navix_mobile/core/voice/speech_service.dart';
import 'package:navix_mobile/features/intelligence/data/intelligence_repository.dart';
import 'package:navix_mobile/features/intelligence/presentation/voice_assistant_cubit.dart';
import 'package:navix_mobile/features/pod/data/pod_queue_store.dart';
import 'package:navix_mobile/features/pod/data/pod_repository.dart';
import 'package:navix_mobile/features/performance/data/driver_performance_repository.dart';
import 'package:navix_mobile/features/performance/presentation/driver_performance_cubit.dart';
import 'package:navix_mobile/features/pod/presentation/pod_sync_cubit.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/route_navigation.dart';
import 'package:navix_mobile/features/route/presentation/my_route_cubit.dart';
import 'package:navix_mobile/core/maps/route_stops_map.dart';
import 'package:navix_mobile/features/route/presentation/my_route_page.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

class _MockIntel extends Mock implements IntelligenceRepository {}

class _MockPodRepo extends Mock implements PodRepository {}

class _MockQueue extends Mock implements PodQueueStore {}

class _MockConn extends Mock implements ConnectivityService {}

class _FakeSpeech implements SpeechService {
  @override
  Future<bool> available() async => false;
  @override
  Future<String?> listenOnce({required String localeId}) async => null;
  @override
  Future<void> speak(String text, {required String localeId}) async {}
  @override
  Future<void> cancel() async {}
}

class _FakeNavigation implements RouteNavigationLauncher {
  RouteNavigationTarget? opened;

  @override
  Future<bool> open(RouteNavigationTarget target) async {
    opened = target;
    return true;
  }
}

class _FakeApi extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final body = options.path.contains('route-plans')
        // Rota vigente do motorista: um plano só, não uma lista (ADR-0098).
        ? {
            'data': {
              'id': 'p1',
              'createdAt': '2026-07-23T09:00:00.000Z',
              'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
              'savings': {'distanceKm': 2, 'distancePct': 17},
              // Forma de `/route-plans/mine/current` (ADR-0127): morada,
              // estado e prioridade vêm na parada, e o progresso vem
              // derivado do servidor.
              'stops': [
                {
                  'sequence': 1,
                  'deliveryId': 'd1',
                  'etaMinutes': 20,
                  'addressText': 'Rua Alfa, 10',
                  'status': 'delivered',
                  'priority': 'normal',
                  'hasLocation': true,
                  'latitude': 38.7223,
                  'longitude': -9.1393,
                },
                {
                  'sequence': 2,
                  'deliveryId': 'd2',
                  'etaMinutes': 45,
                  'addressText': 'Rua Beta, 20',
                  'status': 'pending',
                  'priority': 'high',
                  'hasLocation': true,
                  'latitude': 41.1579,
                  'longitude': -8.6291,
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
              'groups': [
                {
                  'type': 'commerce',
                  'order': 1,
                  'stops': 2,
                  'sequences': [1, 2],
                  'distanceKm': 10.0,
                  'timeMinutes': 45,
                },
              ],
            },
          }
        : {
            'data': [
              {
                'id': 'd1',
                'status': 'delivered',
                'address': {
                  'street': 'Rua Alfa',
                  'number': '10',
                  'city': 'Lisboa',
                  'state': 'LX',
                },
              },
              {
                'id': 'd2',
                'status': 'pending',
                'address': {
                  'street': 'Rua Beta',
                  'number': '20',
                  'city': 'Porto',
                  'state': 'PT',
                },
              },
            ],
          };
    handler.resolve(
      Response(requestOptions: options, statusCode: 200, data: body),
    );
  }
}

Widget host() => MaterialApp(
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const MyRoutePage(),
    );

Future<void> pumpPhone(WidgetTester tester) async {
  tester.view
    ..physicalSize = const Size(390, 844)
    ..devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(host());
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
      ..interceptors.add(_FakeApi());
    final conn = _MockConn();
    when(
      () => conn.onlineChanges,
    ).thenAnswer((_) => const Stream<bool>.empty());
    final navigation = _FakeNavigation();
    GetIt.instance
      ..registerSingleton<RouteNavigationLauncher>(navigation)
      ..registerFactory<MyRouteCubit>(
        () => MyRouteCubit(MyRouteRepository(dio), navigation),
      )
      ..registerFactory<VoiceAssistantCubit>(
        () => VoiceAssistantCubit(_FakeSpeech(), _MockIntel()),
      )
      ..registerSingleton<PodSyncCubit>(
        PodSyncCubit(_MockPodRepo(), _MockQueue(), conn),
      )
      // O cartão de desempenho (ADR-0097) vive na Minha Rota. O `_FakeApi` não
      // conhece `/me/performance`, então ele cai no estado vazio — o que estes
      // testes exigem é que a rota siga utilizável de qualquer forma.
      ..registerFactory<DriverPerformanceCubit>(
        () => DriverPerformanceCubit(DriverPerformanceRepository(dio)),
      );
  });

  tearDown(() => GetIt.instance.reset());

  // A sequência fica abaixo do resumo; a ListView é lazy, então o teste rola
  // até a última parada antes de asseverar (locale padrão do ambiente é en).
  Future<Finder> scrollToLastStop(WidgetTester tester) async {
    final stop = find.text('Rua Beta, 20').last;
    await tester.scrollUntilVisible(
      stop,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    return stop;
  }

  testWidgets('mostra resumo, tipos de destino e ordem das entregas', (
    tester,
  ) async {
    await pumpPhone(tester);

    expect(find.text('1 of 2 deliveries'), findsOneWidget);
    expect(find.text('1 remaining'), findsOneWidget);
    expect(find.text('Next stop'), findsOneWidget);
    expect(find.text('Route summary'), findsOneWidget);
    expect(find.textContaining('10.0 km'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Destination types'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    expect(find.text('Destination types'), findsOneWidget);
    expect(find.text('Commerce'), findsWidgets);
    expect(find.text('How this route was prepared'), findsNothing);
    expect(await scrollToLastStop(tester), findsOneWidget);
  });

  testWidgets('o mapa entra depois do cartão principal', (tester) async {
    await pumpPhone(tester);

    // «Para onde agora» continua a ser a primeira leitura; o mapa responde à
    // pergunta seguinte.
    final cartao = tester.getTopLeft(find.text('Rua Beta, 20')).dy;
    final mapa = tester.getTopLeft(find.text('Route map')).dy;

    expect(mapa, greaterThan(cartao));
  });

  testWidgets('o mapa não cobre o Registrar entrega nem o botão de voz', (
    tester,
  ) async {
    await pumpPhone(tester);

    // Critério de aceite, verificado por geometria e não por inspeção: o mapa
    // vive dentro da lista, e os dois controlos flutuam por fora dela.
    final mapa = tester.getRect(find.byType(RouteStopsMap));
    final registar = tester.getRect(find.byType(FilledButton).last);
    final voz = tester.getRect(find.byType(FloatingActionButton));

    expect(mapa.overlaps(registar), isFalse);
    expect(mapa.overlaps(voz), isFalse);
  });

  testWidgets('sem chave do mapa a tela continua inteira', (tester) async {
    // Nos testes não há `--dart-define` de token, então este é o caminho real
    // de um build sem mapa — e é o critério «fluxos de erro continuam
    // utilizáveis com mapa indisponível».
    await pumpPhone(tester);

    expect(find.text('Map unavailable'), findsOneWidget);
    // E o resto da tela não foi afetado.
    expect(find.text('Rua Beta, 20'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsOneWidget);
    final registar = tester.widget<FilledButton>(
      find.byType(FilledButton).last,
    );
    expect(registar.onPressed, isNotNull);
  });

  testWidgets('a próxima parada aparece no cartão principal', (tester) async {
    await pumpPhone(tester);

    // Sem rolar: o cartão principal é a primeira leitura da tela.
    expect(find.text('Rua Beta, 20'), findsOneWidget);
  });

  testWidgets('mostra as paradas na ordem da rota e com a sua categoria', (
    tester,
  ) async {
    await pumpPhone(tester);
    await tester.scrollUntilVisible(
      find.text('Rua Alfa, 10'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    // As duas paradas são vizinhas na sequência, logo cabem no mesmo ecrã.
    // O cartão principal já não — desde que o mapa entrou na lista (ADR-0130),
    // ele e a sequência estão a mais de um ecrã de distância, e por isso a
    // presença da próxima parada no cartão é afirmada no teste acima.
    expect(find.text('Rua Alfa, 10'), findsOneWidget);
    expect(find.text('Rua Beta, 20'), findsOneWidget);
    // Uma vez no resumo por tipo de destino e uma vez em cada parada.
    expect(find.text('Commerce'), findsNWidgets(3));
  });

  testWidgets(
    'a barra de registrar entrega aparece habilitada quando há pendente',
    (tester) async {
      await pumpPhone(tester);

      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Register delivery'),
      );
      expect(button.onPressed, isNotNull);
    },
  );

  testWidgets('abre navegação externa para a próxima parada', (tester) async {
    await pumpPhone(tester);

    await tester.tap(find.byKey(const ValueKey('navigate-next-stop')));
    await tester.pump();

    final target = GetIt.instance<RouteNavigationLauncher>() as _FakeNavigation;
    expect(target.opened?.deliveryId, 'd2');
    expect(target.opened?.latitude, 41.1579);
    expect(target.opened?.uri.host, 'www.google.com');
    expect(target.opened?.uri.queryParameters['dir_action'], 'navigate');
  });

  testWidgets('a ação de reorganizar abre o sheet com IA (padrão) e Manual', (
    tester,
  ) async {
    await pumpPhone(tester);

    // Ação secundária no AppBar (só com rota pronta e ≥2 paradas).
    await tester.tap(find.byIcon(Icons.tune));
    await tester.pumpAndSettle();

    expect(find.text('AI (Recommended)'), findsOneWidget);
    expect(find.text('Manual'), findsOneWidget);
    // A IA é marcada como recomendada.
    expect(find.text('Recommended'), findsWidgets);
  });
}
