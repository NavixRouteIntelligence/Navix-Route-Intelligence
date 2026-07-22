import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/ui/navix_pulse_dot.dart';

/// Regressão do crash que derrubava o app inteiro ao fechar o menu lateral.
///
/// O controller vivia num inicializador `late final` preguiçoso. Com
/// `animate: false` o build retornava antes de tocar nele, então o `dispose()`
/// disparava a inicialização preguiçosa e *criava* um AnimationController sobre
/// um elemento já desativado → "Looking up a deactivated widget's ancestor is
/// unsafe", quebrando a árvore. O caso decisivo é montar SEM animar e descartar.
void main() {
  testWidgets('descartar sem nunca ter animado não lança', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: NavixPulseDot(color: Colors.green, animate: false)),
    ));
    await tester.pump();

    // Remove o widget da árvore → dispose().
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox.shrink())));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('descartar depois de animar não lança', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: NavixPulseDot(color: Colors.blue, animate: true)),
    ));
    await tester.pump(const Duration(milliseconds: 300));

    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox.shrink())));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('alternar animate liga e desliga o pulso sem lançar', (tester) async {
    Widget host(bool animate) => MaterialApp(
          home: Scaffold(body: NavixPulseDot(color: Colors.green, animate: animate)),
        );

    await tester.pumpWidget(host(false));
    await tester.pump();
    await tester.pumpWidget(host(true));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(host(false));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(NavixPulseDot), findsOneWidget);
  });
}
