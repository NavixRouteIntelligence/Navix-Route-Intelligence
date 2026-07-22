import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/splash/navix_mark.dart';
import 'package:navix_mobile/app/splash/navix_splash.dart';
import 'package:navix_mobile/app/splash/splash_gate.dart';

const _fast = Duration(milliseconds: 300);

Widget _gate({required bool ready, Widget? child}) => MaterialApp(
      home: SplashGate(
        isDataReady: ready,
        child: child ?? const Text('home'),
      ),
    );

void main() {
  group('NavixMark', () {
    test('a rota vai da origem ao destino e tem comprimento', () {
      final path = NavixMark.routePath();
      final metrics = path.computeMetrics().toList();
      expect(metrics, isNotEmpty);
      expect(metrics.first.length, greaterThan(0));

      final bounds = path.getBounds();
      expect(bounds.width, greaterThan(0));
      expect(bounds.height, greaterThan(0));
      // Cabe na caixa de design.
      expect(bounds.right, lessThanOrEqualTo(NavixMark.designSize));
      expect(bounds.bottom, lessThanOrEqualTo(NavixMark.designSize));
    });

    test('scaleTo centra a marca no ponto pedido', () {
      final scaled = NavixMark.scaleTo(
        NavixMark.routePath(),
        center: const Offset(200, 300),
        side: 100,
      );
      final c = scaled.getBounds().center;
      // O "N" não é simétrico na vertical; basta ficar próximo do centro pedido.
      expect((c.dx - 200).abs(), lessThan(12));
      expect((c.dy - 300).abs(), lessThan(12));
    });

    test('a seta fica no destino da rota', () {
      final arrow = NavixMark.arrowPath().getBounds();
      expect((arrow.center.dx - NavixMark.destination.dx).abs(), lessThan(2));
    });
  });

  group('SplashGate', () {
    testWidgets('segura a home enquanto a encenação não termina', (tester) async {
      await tester.pumpWidget(_gate(ready: true));
      await tester.pump();

      // A home existe na árvore (o app carrega por baixo), mas está encoberta.
      final splashOpacity = tester.widgetList<Opacity>(find.byType(Opacity)).first;
      expect(splashOpacity.opacity, lessThan(1));

      await tester.pumpAndSettle(const Duration(seconds: 4));
      expect(find.text('home'), findsOneWidget);
    });

    testWidgets('dados prontos antes da animação: espera a animação terminar', (tester) async {
      await tester.pumpWidget(_gate(ready: true));
      await tester.pump(_fast);

      // Bem antes do fim da encenação, a saída ainda não começou.
      expect(find.byType(NavixSplash), findsOneWidget);

      await tester.pumpAndSettle(const Duration(seconds: 4));
      expect(find.byType(NavixSplash), findsNothing);
    });

    testWidgets('animação pronta antes dos dados: mantém a splash e não trava', (tester) async {
      await tester.pumpWidget(_gate(ready: false));
      // Passa muito além da encenação inteira.
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 3));

      // Sem dados, a splash continua — com o movimento ambiente em loop.
      expect(find.byType(NavixSplash), findsOneWidget);

      // Dados chegam → dissolve para a home.
      await tester.pumpWidget(_gate(ready: true));
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(find.byType(NavixSplash), findsNothing);
      expect(find.text('home'), findsOneWidget);
    });
  });

  group('acessibilidade', () {
    testWidgets('Reduce Motion entrega a marca sem encenação', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: SplashGate(isDataReady: true, child: Text('home')),
        ),
      ));
      // Sem esperar a encenação inteira: com Reduce Motion ela é imediata.
      await tester.pumpAndSettle(const Duration(seconds: 1));

      expect(find.text('home'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('a splash monta e descarta sem lançar', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: NavixSplash()));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
