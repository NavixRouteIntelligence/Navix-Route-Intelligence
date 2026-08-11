import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';
import 'package:navix_mobile/features/route/domain/route_navigation.dart';
import 'package:navix_mobile/features/route/presentation/my_route_cubit.dart';
import 'package:navix_mobile/features/route/presentation/stop_details_sheet.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

class _Repository extends Mock implements MyRouteRepository {}

class _Navigation extends Mock implements RouteNavigationLauncher {}

const _fallback = RouteNavigationTarget(
  deliveryId: 'd1',
  latitude: 38.72,
  longitude: -9.14,
);

RouteStopInfo stop({
  int sequence = 3,
  String status = 'pending',
  String priority = 'normal',
  String address = 'Rua Alfa, 10 — Lisboa — LX',
  double? lat = 38.72,
}) =>
    RouteStopInfo(
      sequence: sequence,
      deliveryId: 'd1',
      addressLine: address,
      cityLine: '',
      etaMinutes: 18.4,
      status: status,
      priority: priority,
      latitude: lat,
      longitude: -9.14,
    );

/// Abre a folha como a tela a abre, com o Cubit por trás.
Future<RouteNavigationLauncher> pumpSheet(
  WidgetTester tester, {
  required RouteStopInfo info,
  bool isNext = false,
}) async {
  final repository = _Repository();
  final navigation = _Navigation();
  when(() => repository.load()).thenAnswer(
    (_) async => MyRoute(
      status: MyRouteStatus.ready,
      stops: [info],
      next: NextDelivery(id: info.deliveryId, label: info.addressLine),
    ),
  );
  when(() => navigation.open(any())).thenAnswer((_) async => true);
  final cubit = MyRouteCubit(repository, navigation);
  await cubit.load();
  addTearDown(cubit.close);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: BlocProvider.value(
        value: cubit,
        child: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () =>
                  showStopDetailsSheet(context, stop: info, isNext: isNext),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
  return navigation;
}

void main() {
  setUpAll(() => registerFallbackValue(_fallback));

  testWidgets('mostra sequência, morada, estado, prioridade e ETA', (
    tester,
  ) async {
    await pumpSheet(tester, info: stop(sequence: 3, priority: 'high'));

    expect(find.text('Stop 3'), findsOneWidget);
    expect(find.text('Rua Alfa, 10 — Lisboa — LX'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('High'), findsOneWidget);
    // 18.4 arredonda para 18 — minutos com casa decimal não são informação
    // para quem conduz.
    expect(find.text('18 min'), findsOneWidget);
  });

  testWidgets('a próxima parada anuncia-se como próxima, não como pendente', (
    tester,
  ) async {
    await pumpSheet(tester, info: stop(), isNext: true);

    expect(find.text('Next stop'), findsOneWidget);
    expect(find.text('Pending'), findsNothing);
  });

  testWidgets('estado desconhecido do backend não mostra a chave crua', (
    tester,
  ) async {
    // `aguardando_terceiro` no ecrã não diz nada a quem conduz — e um estado
    // novo no servidor não pode partir a folha.
    await pumpSheet(tester, info: stop(status: 'aguardando_terceiro'));

    expect(find.text('aguardando_terceiro'), findsNothing);
    expect(find.text('Pending'), findsOneWidget);
  });

  testWidgets('prioridade desconhecida não inventa urgência', (tester) async {
    await pumpSheet(tester, info: stop(priority: 'quem_sabe'));

    expect(find.text('Normal'), findsOneWidget);
    expect(find.text('Urgent'), findsNothing);
  });

  testWidgets('Navegar usa o lançador existente e fecha a folha', (
    tester,
  ) async {
    final navigation = await pumpSheet(tester, info: stop());

    await tester.tap(find.text('Navigate'));
    await tester.pumpAndSettle();

    final alvo = verify(() => navigation.open(captureAny())).captured.single
        as RouteNavigationTarget;
    expect(alvo.deliveryId, 'd1');
    expect(alvo.latitude, 38.72);
    // A folha sai do caminho: quem toca em navegar vai sair da app.
    expect(find.text('Stop 3'), findsNothing);
  });

  testWidgets('sem coordenada não há botão de navegar', (tester) async {
    // Um botão que abre o mapa no sítio errado é pior do que um botão ausente.
    await pumpSheet(tester, info: stop(lat: null));

    expect(find.text('Navigate'), findsNothing);
    expect(
      find.text('This stop has no location to navigate to.'),
      findsOneWidget,
    );
  });

  testWidgets('morada em falta não deixa a linha vazia', (tester) async {
    await pumpSheet(tester, info: stop(address: ''));

    expect(find.text('Address not available'), findsOneWidget);
  });
}
