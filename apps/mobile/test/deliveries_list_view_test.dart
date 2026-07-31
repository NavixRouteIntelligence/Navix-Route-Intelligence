import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/features/deliveries/data/deliveries_repository.dart';
import 'package:navix_mobile/features/deliveries/domain/delivery_summary.dart';
import 'package:navix_mobile/features/deliveries/presentation/deliveries_cubit.dart';
import 'package:navix_mobile/features/deliveries/presentation/widgets/deliveries_list_view.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

class _MockRepository extends Mock implements DeliveriesRepository {}

final _items = [
  DeliverySummary(
    id: 'urgent',
    addressLine: 'Rua Vergueiro, 3000',
    city: 'São Paulo',
    status: DeliveryStatusView.pending,
    priority: DeliveryPriorityView.urgent,
    windowStart: DateTime(2026, 7, 29, 10, 37),
    windowEnd: DateTime(2026, 7, 29, 18, 37),
    notes: null,
  ),
  DeliverySummary(
    id: 'delivered',
    addressLine: 'Rua Augusta, 900',
    city: 'São Paulo',
    status: DeliveryStatusView.delivered,
    priority: DeliveryPriorityView.normal,
    windowStart: DateTime(2026, 7, 29, 10, 37),
    windowEnd: DateTime(2026, 7, 29, 18, 37),
    notes: null,
  ),
  DeliverySummary(
    id: 'high',
    addressLine: 'Avenida Paulista, 1578',
    city: 'São Paulo',
    status: DeliveryStatusView.inRoute,
    priority: DeliveryPriorityView.high,
    windowStart: DateTime(2026, 7, 29, 10, 37),
    windowEnd: DateTime(2026, 7, 29, 18, 37),
    notes: null,
  ),
];

Widget _host(_MockRepository repository, {bool driverView = true}) =>
    BlocProvider(
      create: (_) => DeliveriesCubit(repository)..load(),
      child: MaterialApp(
        theme: AppTheme.dark(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: DeliveriesListView(driverView: driverView),
        ),
      ),
    );

void main() {
  late _MockRepository repository;

  setUp(() {
    repository = _MockRepository();
    when(
      () => repository.list(
        status: any(named: 'status'),
        pageSize: any(named: 'pageSize'),
      ),
    ).thenAnswer(
      (_) async => DeliveriesPage(items: _items, total: _items.length),
    );
  });

  Future<void> pumpPhone(
    WidgetTester tester, {
    bool driverView = true,
  }) async {
    tester.view
      ..physicalSize = const Size(390, 844)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_host(repository, driverView: driverView));
    await tester.pumpAndSettle();
  }

  testWidgets('motorista vê resumo, contadores e prioridades reais', (
    tester,
  ) async {
    await pumpPhone(tester);

    expect(find.text("Today's deliveries"), findsOneWidget);
    expect(find.text('3 deliveries today'), findsOneWidget);
    expect(find.text('1 completed'), findsOneWidget);
    expect(find.text('2 remaining'), findsOneWidget);
    expect(find.text('Priority now'), findsOneWidget);
    expect(find.text('Rua Vergueiro, 3000'), findsOneWidget);
    expect(find.text('Deliver by 18:37'), findsWidgets);
  });

  testWidgets(
      'a visão compartilhada da empresa permanece sem o resumo do motorista', (
    tester,
  ) async {
    await pumpPhone(tester, driverView: false);

    expect(find.text("Today's deliveries"), findsNothing);
    expect(find.text('Rua Vergueiro, 3000'), findsOneWidget);
  });
}
