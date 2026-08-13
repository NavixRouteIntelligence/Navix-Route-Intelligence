import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';
import 'package:navix_mobile/features/route/presentation/route_map_section.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

RouteStopInfo parada(int sequence, {double? lat = 38.72}) => RouteStopInfo(
      sequence: sequence,
      deliveryId: 'd$sequence',
      addressLine: 'Rua $sequence',
      cityLine: '',
      etaMinutes: sequence * 10,
      latitude: lat,
      longitude: lat == null ? null : -9.14,
    );

MyRoute rota({RouteLine? line, int paradas = 3, int semLocal = 0}) => MyRoute(
      status: MyRouteStatus.ready,
      totalStops: paradas,
      stops: [
        for (var i = 1; i <= paradas; i++)
          parada(i, lat: i <= paradas - semLocal ? 38.72 : null),
      ],
      next: const NextDelivery(id: 'd1', label: 'Rua 1'),
      line: line,
    );

RouteLine linha({int coveredStops = 3, int totalStops = 3}) => RouteLine(
      coordinates: const [
        [-9.13, 38.72],
        [-9.14, 38.73],
      ],
      profile: 'driving',
      coveredStops: coveredStops,
      totalStops: totalStops,
    );

Future<void> pump(WidgetTester tester, MyRoute r) async {
  tester.view
    ..physicalSize = const Size(390, 844)
    ..devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
          body: SingleChildScrollView(child: RouteMapSection(route: r))),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sem traçado, a tela diz que a ordem continua certa', (
    tester,
  ) async {
    // O critério de aceite: a interface identifica quando os dados são
    // aproximados. A ausência de linha parece a app avariada se não for dita —
    // e as paragens e a ordem continuam corretas.
    await pump(tester, rota());

    expect(
      find.text(
        'Route outline unavailable. The stops and their order are correct.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('traçado completo não gera aviso nenhum', (tester) async {
    await pump(tester, rota(line: linha()));

    expect(
      find.textContaining('Route outline unavailable'),
      findsNothing,
    );
    expect(find.textContaining('The line skips'), findsNothing);
  });

  testWidgets('traçado que salta paragens é anunciado como parcial', (
    tester,
  ) async {
    // Uma linha que salta paragens parece o percurso completo. Sem esta nota,
    // o motorista leria como se a rota passasse por onde não passa.
    await pump(
      tester,
      rota(
        paradas: 5,
        semLocal: 2,
        line: linha(coveredStops: 3, totalStops: 5),
      ),
    );

    expect(find.textContaining('The line skips'), findsOneWidget);
    expect(find.textContaining('2 stops without a location'), findsOneWidget);
  });

  testWidgets('o aviso do traçado é lido por leitores de ecrã', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester, rota());

    expect(
      find.bySemanticsLabel(RegExp('Route outline unavailable')),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('sem paragens localizáveis não há aviso de traçado', (
    tester,
  ) async {
    // Aqui o mapa já está no estado vazio e explica-se sozinho; um segundo
    // aviso a dizer que falta a linha seria ruído sobre ruído.
    await pump(tester, rota(paradas: 2, semLocal: 2));

    expect(find.textContaining('Route outline unavailable'), findsNothing);
  });
}
