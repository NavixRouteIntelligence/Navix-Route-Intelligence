import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/finance/data/finance_repository.dart';
import 'package:navix_mobile/features/finance/domain/finance_models.dart';
import 'package:navix_mobile/features/finance/domain/history_models.dart';
import 'package:navix_mobile/features/finance/domain/insights_models.dart';
import 'package:navix_mobile/features/finance/presentation/finance_cubit.dart';

class _MockRepo extends Mock implements FinanceRepository {}

class _FakeNewEntry extends Fake implements NewFinancialEntry {}

void main() {
  late _MockRepo repo;

  const summary = FinancialSummary(
    totalIncome: 200,
    totalExpense: 125,
    balance: 75,
    distanceKm: 400,
    costPerKm: 0.31,
    deliveries: 4,
    profitPerDelivery: 18.75,
  );
  const entry = FinancialEntry(id: 'e1', type: 'expense', category: 'fuel', amount: 62.5, occurredAt: '2026-07-10', liters: 40, odometerKm: 100000);

  setUpAll(() => registerFallbackValue(_FakeNewEntry()));
  setUp(() => repo = _MockRepo());

  blocTest<FinanceCubit, FinanceState>(
    'load: resumo + lançamentos → ready',
    build: () {
      when(() => repo.summary()).thenAnswer((_) async => summary);
      when(() => repo.entries()).thenAnswer((_) async => [entry]);
      when(() => repo.insights()).thenAnswer((_) async => const DeliveryInsights());
      when(() => repo.history(granularity: any(named: 'granularity'))).thenAnswer((_) async => const FinancialHistory());
      return FinanceCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      FinanceState(status: FinanceStatus.loading),
      FinanceState(status: FinanceStatus.ready, summary: summary, entries: [entry]),
    ],
  );

  blocTest<FinanceCubit, FinanceState>(
    'loadSummary: só o resumo (card do painel)',
    build: () {
      when(() => repo.summary()).thenAnswer((_) async => summary);
      return FinanceCubit(repo);
    },
    act: (c) => c.loadSummary(),
    expect: () => const [
      FinanceState(status: FinanceStatus.ready, summary: summary),
    ],
    verify: (_) => verifyNever(() => repo.entries()),
  );

  blocTest<FinanceCubit, FinanceState>(
    'load: falha → error',
    build: () {
      when(() => repo.summary()).thenThrow(const NetworkFailure());
      return FinanceCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      FinanceState(status: FinanceStatus.loading),
      FinanceState(status: FinanceStatus.error, error: 'Sem conexão com o servidor.'),
    ],
  );

  blocTest<FinanceCubit, FinanceState>(
    'addEntry: envia e recarrega resumo + lançamentos',
    build: () {
      when(() => repo.summary()).thenAnswer((_) async => summary);
      when(() => repo.entries()).thenAnswer((_) async => [entry]);
      when(() => repo.insights()).thenAnswer((_) async => const DeliveryInsights());
      when(() => repo.history(granularity: any(named: 'granularity'))).thenAnswer((_) async => const FinancialHistory());
      when(() => repo.addEntry(any())).thenAnswer((_) async {});
      return FinanceCubit(repo);
    },
    act: (c) async {
      await c.load();
      await c.addEntry(const NewFinancialEntry(type: 'expense', category: 'toll', amount: 2.5, occurredAt: '2026-07-11'));
    },
    verify: (_) {
      verify(() => repo.addEntry(any())).called(1);
      verify(() => repo.summary()).called(2); // load + após mutação
    },
  );

  blocTest<FinanceCubit, FinanceState>(
    'deleteEntry: apaga e recarrega',
    build: () {
      when(() => repo.summary()).thenAnswer((_) async => summary);
      when(() => repo.entries()).thenAnswer((_) async => [entry]);
      when(() => repo.insights()).thenAnswer((_) async => const DeliveryInsights());
      when(() => repo.history(granularity: any(named: 'granularity'))).thenAnswer((_) async => const FinancialHistory());
      when(() => repo.deleteEntry(any())).thenAnswer((_) async {});
      return FinanceCubit(repo);
    },
    act: (c) async {
      await c.load();
      await c.deleteEntry('e1');
    },
    verify: (_) => verify(() => repo.deleteEntry('e1')).called(1),
  );
}
