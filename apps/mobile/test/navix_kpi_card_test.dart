import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/ui/navix_kpi_card.dart';

void main() {
  testWidgets('NavixKpiCard renderiza rótulo, valor e variação com os tokens', (
    tester,
  ) async {
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

  // O card vive numa grade de altura fixa. Com o chip de variação o conteúdo
  // passava da célula e o Flutter pintava "BOTTOM OVERFLOWED BY 17 PIXELS"
  // por cima do dashboard da Empresa. Aqui a célula é apertada de propósito:
  // o valor tem de encolher em vez de estourar.
  testWidgets('não estoura o layout numa célula apertada (com chip)',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        home: const Scaffold(
          body: Center(
            child: SizedBox(
              // Geometria real do pior caso do app: num iPhone de 375pt, a
              // grade de 2 colunas dá ~165pt de largura e ~114pt de altura
              // (childAspectRatio 1.45). Era aí que o card estourava.
              width: 165,
              height: 114,
              child: NavixKpiCard(
                icon: Icons.local_gas_station_outlined,
                label: 'Economia',
                value: '13218 km',
                deltaLabel: '55%',
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('13218 km'), findsOneWidget);
    expect(find.text('55%'), findsOneWidget);
  });
}
