import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/maps/route_stop_marker.dart';
import 'package:navix_mobile/core/maps/route_stops_map.dart';
import 'package:navix_mobile/core/maps/stop_marker_painter.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';
import 'package:navix_mobile/features/route/presentation/route_map_markers.dart';

/// Validação do mapa nos eixos que a T8.10 exige: **todos** os estados de
/// marcador, os dois temas, escala de texto, rotação e ciclo de vida.

RouteStopInfo parada(int i, {String status = 'pending', double? lat = 38.72}) =>
    RouteStopInfo(
      sequence: i,
      deliveryId: 'd$i',
      addressLine: 'Rua $i',
      cityLine: '',
      etaMinutes: i * 10.0,
      status: status,
      latitude: lat,
      longitude: lat == null ? null : -9.14,
    );

MyRoute rotaCom(List<RouteStopInfo> stops, {String? nextId}) => MyRoute(
      status: MyRouteStatus.ready,
      stops: stops,
      next: nextId == null ? null : NextDelivery(id: nextId, label: 'Rua'),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('todos os estados de marcador', () {
    test('a rota produz um marcador por estado possível', () {
      // Se um estado deixasse de ser produzido, o mapa passaria a desenhar
      // paragens concluídas como pendentes — e nada falharia.
      final markers = markersFrom(
        rotaCom(
          [
            parada(1, status: 'delivered'),
            parada(2, status: 'failed'),
            parada(3, status: 'pending'),
            parada(4, status: 'pending'),
          ],
          nextId: 'd3',
        ),
      );

      expect(
        markers.map((m) => m.status).toSet(),
        RouteStopStatus.values.toSet(),
      );
    });

    for (final status in RouteStopStatus.values) {
      testWidgets('$status desenha um pino legível', (tester) async {
        final palette = StopMarkerPalette.of(await _contextoDe(tester));
        // `runAsync` porque pintar uma imagem é assíncrono **de verdade**: no
        // relógio falso do `testWidgets` o `toImage` nunca completa, e o teste
        // fica pendurado em vez de falhar.
        final bytes = await tester.runAsync(
          () => paintStopMarker(
            sequence: 7,
            status: status,
            palette: palette,
            textScale: 1.0,
            devicePixelRatio: 2,
          ),
        );

        expect(bytes!.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);
      });
    }

    testWidgets('os quatro estados produzem quatro desenhos diferentes', (
      tester,
    ) async {
      // Distinguir por cor não basta para quem não distingue cores — mas
      // desenhos iguais não distinguem para ninguém.
      final palette = StopMarkerPalette.of(await _contextoDe(tester));
      final desenhos = <String>{};
      for (final status in RouteStopStatus.values) {
        final bytes = await tester.runAsync(
          () => paintStopMarker(
            sequence: 7,
            status: status,
            palette: palette,
            textScale: 1.0,
            devicePixelRatio: 1,
          ),
        );
        desenhos.add(bytes!.join(','));
      }

      expect(desenhos, hasLength(RouteStopStatus.values.length));
    });
  });

  group('tema', () {
    testWidgets('a paleta muda entre claro e escuro', (tester) async {
      final escuro = StopMarkerPalette.of(await _contextoDe(tester));
      final claro = StopMarkerPalette.of(
        await _contextoDe(tester, theme: AppTheme.light()),
      );

      // O anel é a superfície do tema, e é ele que separa o pino do mapa.
      expect(escuro.outline, isNot(claro.outline));
    });

    for (final claro in [true, false]) {
      testWidgets(
          'o contraste do número aguenta o tema ${claro ? 'claro' : 'escuro'}',
          (
        tester,
      ) async {
        final palette = StopMarkerPalette.of(
          await _contextoDe(tester,
              theme: claro ? AppTheme.light() : AppTheme.dark()),
        );

        for (final status in RouteStopStatus.values) {
          final fill = palette.forStatus(status);
          expect(
            contrastRatio(fill, labelColorOn(fill)),
            greaterThanOrEqualTo(4.5),
            reason: 'contraste insuficiente em $status',
          );
        }
      });
    }
  });

  group('escala de texto', () {
    testWidgets('o mapa continua a montar com o texto no máximo',
        (tester) async {
      // Dynamic Type no limite é onde as telas rebentam por transbordo.
      tester.view
        ..physicalSize = const Size(390, 844)
        ..devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(),
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
            child: Scaffold(
              body: RouteStopsMap(
                stops: markersFrom(rotaCom([parada(1)], nextId: 'd1')),
                isSdkReady: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('rotação e ciclo de vida', () {
    testWidgets('mudar de tamanho não parte o mapa', (tester) async {
      // Rodar o telemóvel é uma mudança de tamanho e uma reconstrução: o mapa
      // não pode recriar estado a meio nem estourar.
      tester.view
        ..physicalSize = const Size(390, 844)
        ..devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_host(rotaCom([parada(1)], nextId: 'd1')));
      await tester.pumpAndSettle();

      tester.view.physicalSize = const Size(844, 390);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('desmontar o mapa não deixa exceções pendentes',
        (tester) async {
      // O widget cancela a subscrição de toques ao sair; sem isso, um toque
      // depois de fechar a tela chamaria um callback de um estado morto.
      await tester.pumpWidget(_host(rotaCom([parada(1)], nextId: 'd1')));
      await tester.pumpAndSettle();

      await tester
          .pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox())));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('a rota mudar por baixo do mapa não estoura', (tester) async {
      // É o que acontece a cada POD e a cada puxar-para-atualizar.
      await tester
          .pumpWidget(_host(rotaCom([parada(1), parada(2)], nextId: 'd1')));
      await tester.pumpAndSettle();

      await tester.pumpWidget(
        _host(
          rotaCom(
            [parada(1, status: 'delivered'), parada(2)],
            nextId: 'd2',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}

Widget _host(MyRoute rota) => MaterialApp(
      theme: AppTheme.dark(),
      home: Scaffold(
        body: RouteStopsMap(
          stops: markersFrom(rota),
          // Sem SDK: é o caminho de um dispositivo sem mapa, e o que se
          // verifica aqui é que o widget monta, remonta e desmonta em paz.
          isSdkReady: false,
        ),
      ),
    );

/// Um contexto com tema, para ler a paleta como a tela a lê.
Future<BuildContext> _contextoDe(WidgetTester tester,
    {ThemeData? theme}) async {
  final escolhido = theme ?? AppTheme.dark();
  late BuildContext capturado;
  await tester.pumpWidget(
    MaterialApp(
      // A chave força uma árvore nova a cada tema: sem ela, dois `pumpWidget`
      // no mesmo teste reaproveitam os elementos e o segundo lê o tema do
      // primeiro — o teste passaria a comparar o escuro consigo mesmo.
      key: ValueKey(escolhido.brightness),
      theme: escolhido,
      home: Builder(
        builder: (context) {
          capturado = context;
          return const SizedBox();
        },
      ),
    ),
  );
  return capturado;
}
