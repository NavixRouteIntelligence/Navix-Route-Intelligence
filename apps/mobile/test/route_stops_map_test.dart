import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/maps/map_config.dart';
import 'package:navix_mobile/core/maps/route_stop_marker.dart';
import 'package:navix_mobile/core/maps/route_stops_map.dart';

const comToken = MapConfig(
  accessToken: 'pk.eyJ1IjoibmF2aXgtdGVzdGUiLCJhIjoiY2wifQ',
  environment: 'test',
);

const semToken = MapConfig(accessToken: '', environment: 'test');

/// Um `sk.` colado por engano no lugar do `pk.` (ADR-0128).
const comTokenSecreto = MapConfig(
  accessToken: 'sk.eyJ1IjoibmF2aXgtdGVzdGUiLCJhIjoiY2wifQ',
  environment: 'test',
);

Widget host(Widget child, {ThemeData? theme}) => MaterialApp(
      theme: theme ?? AppTheme.dark(),
      home: Scaffold(body: child),
    );

RouteStopMarker pin(String id, {double? lat = 38.72, double? lng = -9.14}) =>
    RouteStopMarker(
      deliveryId: id,
      sequence: 1,
      status: RouteStopStatus.pending,
      latitude: lat,
      longitude: lng,
    );

void main() {
  testWidgets('sem token, explica-se e não fala em erro', (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [pin('a')],
          config: semToken,
          isSdkReady: true,
        ),
      ),
    );

    expect(find.text('Mapa indisponível'), findsOneWidget);
    // A rota está bem. Dizer «erro» aqui faria o motorista duvidar das
    // entregas, que é o oposto do que se passa.
    expect(find.textContaining('rota continua disponível'), findsOneWidget);
  });

  testWidgets('um sk. colado por engano não liga o mapa', (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [pin('a')],
          config: comTokenSecreto,
          isSdkReady: true,
        ),
      ),
    );

    expect(find.text('Mapa indisponível'), findsOneWidget);
  });

  testWidgets('SDK que não arrancou tem a sua própria explicação',
      (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [pin('a')],
          config: comToken,
          isSdkReady: false,
        ),
      ),
    );

    expect(
        find.textContaining('não arrancou neste dispositivo'), findsOneWidget);
  });

  testWidgets('a carregar mostra progresso e não o estado vazio',
      (tester) async {
    await tester.pumpWidget(
      host(
        const RouteStopsMap(
          stops: [],
          config: comToken,
          isSdkReady: true,
          isLoading: true,
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    // Sem esta ordem, uma rota a carregar anunciaria «sem pontos» durante o
    // tempo em que ainda não se sabe nada.
    expect(find.text('Sem pontos para mostrar'), findsNothing);
  });

  testWidgets('nenhuma parada localizável dá estado vazio', (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [
            pin('a', lat: null, lng: null),
            pin('b', lat: double.nan, lng: -9.14),
          ],
          config: comToken,
          isSdkReady: true,
        ),
      ),
    );

    expect(find.text('Sem pontos para mostrar'), findsOneWidget);
  });

  testWidgets('uma parada localizável entre inválidas já não é vazio',
      (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [
            pin('a', lat: null, lng: null),
            pin('b'),
          ],
          config: comToken,
          isSdkReady: true,
        ),
      ),
    );

    // O critério de aceite: uma morada por localizar não pode esconder as
    // outras. Aqui o mapa entra em cena — o que se afirma é que **não** ficou
    // no estado vazio.
    expect(find.text('Sem pontos para mostrar'), findsNothing);
  });

  testWidgets('o aviso de mapa desligado funciona no tema claro',
      (tester) async {
    await tester.pumpWidget(
      host(
        RouteStopsMap(
          stops: [pin('a')],
          config: semToken,
          isSdkReady: true,
        ),
        theme: AppTheme.light(),
      ),
    );

    expect(find.text('Mapa indisponível'), findsOneWidget);
  });

  testWidgets('os textos são substituíveis por quem embute o mapa',
      (tester) async {
    // O widget não depende do l10n da tela — quem o usa passa os seus textos.
    // É o que o mantém reutilizável fora da rota do dia.
    await tester.pumpWidget(
      host(
        const RouteStopsMap(
          stops: [],
          config: comToken,
          isSdkReady: true,
          emptyTitle: 'Nada por aqui',
        ),
      ),
    );

    expect(find.text('Nada por aqui'), findsOneWidget);
  });
}
