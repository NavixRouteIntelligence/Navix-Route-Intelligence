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
import 'package:navix_mobile/features/pod/presentation/pod_sync_cubit.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/presentation/my_route_cubit.dart';
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

class _FakeApi extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final body = options.path.contains('route-plans')
        ? {
            'data': [
              {
                'id': 'p1',
                'createdAt': '2026-07-23T09:00:00.000Z',
                'metrics': {'totalDistanceKm': 10, 'totalTimeMinutes': 60},
                'savings': {'distanceKm': 2, 'distancePct': 17},
                'stops': [
                  {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 20},
                  {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 45},
                ],
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
            ],
          }
        : {
            'data': [
              {
                'id': 'd1',
                'address': {'street': 'Rua Alfa', 'number': '10', 'city': 'Lisboa', 'state': 'LX'},
              },
              {
                'id': 'd2',
                'address': {'street': 'Rua Beta', 'number': '20', 'city': 'Porto', 'state': 'PT'},
              },
            ],
          };
    handler.resolve(Response(requestOptions: options, statusCode: 200, data: body));
  }
}

Widget host() => MaterialApp(
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const MyRoutePage(),
    );

void main() {
  setUp(() {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))..interceptors.add(_FakeApi());
    final conn = _MockConn();
    when(() => conn.onlineChanges).thenAnswer((_) => const Stream<bool>.empty());
    GetIt.instance
      ..registerFactory<MyRouteCubit>(() => MyRouteCubit(MyRouteRepository(dio)))
      ..registerFactory<VoiceAssistantCubit>(() => VoiceAssistantCubit(_FakeSpeech(), _MockIntel()))
      ..registerSingleton<PodSyncCubit>(PodSyncCubit(_MockPodRepo(), _MockQueue(), conn));
  });

  tearDown(() => GetIt.instance.reset());

  CrossFadeState fadeState(WidgetTester tester) =>
      tester.widget<AnimatedCrossFade>(find.byType(AnimatedCrossFade)).crossFadeState;

  // O grupo fica abaixo do resumo e do painel da IA; a ListView é lazy, então
  // o teste rola até ele antes de asseverar (locale padrão do ambiente é en).
  Future<Finder> scrollToGroup(WidgetTester tester) async {
    final group = find.text('Commerce');
    await tester.scrollUntilVisible(group, 200, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    return group;
  }

  testWidgets('mostra o resumo e o grupo da IA', (tester) async {
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    expect(find.textContaining('10.0 km'), findsWidgets);
    expect(await scrollToGroup(tester), findsOneWidget);
  });

  testWidgets('tocar no grupo expande e recolhe a lista de paradas', (tester) async {
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await scrollToGroup(tester);

    // AnimatedCrossFade mantém os dois filhos na árvore: o que muda é qual
    // está visível, então a asserção é sobre o estado do crossfade — não sobre
    // a presença do texto.
    expect(fadeState(tester), CrossFadeState.showFirst);

    await tester.tap(find.text('Commerce'));
    await tester.pumpAndSettle();
    expect(fadeState(tester), CrossFadeState.showSecond);

    await tester.tap(find.text('Commerce'));
    await tester.pumpAndSettle();
    expect(fadeState(tester), CrossFadeState.showFirst);
  });

  testWidgets('a barra de registrar entrega aparece habilitada quando há pendente', (tester) async {
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Register delivery'));
    expect(button.onPressed, isNotNull);
  });
}
