import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/ui/navix_button.dart';

void main() {
  testWidgets('NavixButton mostra o rótulo e dispara onPressed', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NavixButton(label: 'Entrar', onPressed: () => tapped++),
        ),
      ),
    );

    expect(find.text('Entrar'), findsOneWidget);
    await tester.tap(find.byType(NavixButton));
    expect(tapped, 1);
  });

  testWidgets('NavixButton em loading não dispara onPressed', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NavixButton(label: 'Entrar', loading: true, onPressed: () => tapped++),
        ),
      ),
    );

    await tester.tap(find.byType(NavixButton));
    expect(tapped, 0);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
