import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/ui/navix_kpi_card.dart';

void main() {
  testWidgets('NavixKpiCard renderiza rótulo, valor e variação com os tokens', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        home: const Scaffold(
          body: NavixKpiCard(
            icon: Icons.inventory_2_outlined,
            label: 'Entregas',
            value: '128',
            deltaLabel: '12%',
          ),
        ),
      ),
    );

    expect(find.text('Entregas'), findsOneWidget);
    expect(find.text('128'), findsOneWidget);
    expect(find.text('12%'), findsOneWidget);
  });
}
