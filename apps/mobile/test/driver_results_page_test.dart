import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/features/finance/presentation/driver_results_page.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/route_navigation.dart';
import 'package:navix_mobile/features/route/presentation/my_route_cubit.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

class _FakeApi extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final body = options.path.contains('route-plans')
        // Rota vigente do motorista: um plano só, não uma lista (ADR-0098).
        ? {
            'data': {
              'id': 'plan-1',
              'metrics': {
                'totalDistanceKm': 30,
                'totalTimeMinutes': 90,
              },
              'baseline': {
                'totalDistanceKm': 40,
                'totalTimeMinutes': 120,
              },
              'savings': {
                'distanceKm': 10,
                'distancePct': 25,
                'timeMinutes': 30,
                'timePct': 25,
              },
              'params': {'vehicleType': 'car'},
              'stops': [
                {'sequence': 1, 'deliveryId': 'd1', 'etaMinutes': 30},
                {'sequence': 2, 'deliveryId': 'd2', 'etaMinutes': 60},
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
                  'city': 'Lisboa',
                  'state': 'LX',
                },
              },
            ],
          };

    handler.resolve(
      Response(requestOptions: options, statusCode: 200, data: body),
    );
  }
}

class _FakeNavigation implements RouteNavigationLauncher {
  @override
  Future<bool> open(RouteNavigationTarget target) async => false;
}

Widget _host() => MaterialApp(
      locale: const Locale('pt', 'BR'),
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const DriverResultsPage(),
    );

void main() {
  setUp(() {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'))
      ..interceptors.add(_FakeApi());
    GetIt.instance.registerFactory<MyRouteCubit>(
      () => MyRouteCubit(MyRouteRepository(dio), _FakeNavigation()),
    );
  });

  tearDown(() => GetIt.instance.reset());

  testWidgets('mostra economia real da rota sem lançamentos financeiros', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(390, 844)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    expect(find.text('Resultados'), findsOneWidget);
    expect(find.text('Economia de combustível'), findsWidgets);
    expect(find.text('0.80 L'), findsWidgets);
    expect(find.text('Comparação da rota'), findsOneWidget);
    expect(find.text('Ordem original'), findsOneWidget);
    expect(find.text('Rota Navix'), findsOneWidget);
    expect(find.text('Adicionar lançamento'), findsNothing);
    expect(find.byType(FloatingActionButton), findsNothing);

    await tester.scrollUntilVisible(
      find.text('Seu impacto'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('10.0 km'), findsOneWidget);
    expect(find.text('30min'), findsWidgets);
    expect(find.text('+25%'), findsOneWidget);
  });
}
