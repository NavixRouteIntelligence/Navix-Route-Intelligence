import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/features/performance/data/driver_performance_repository.dart';
import 'package:navix_mobile/features/performance/domain/driver_performance.dart';
import 'package:navix_mobile/features/performance/presentation/driver_performance_card.dart';
import 'package:navix_mobile/features/performance/presentation/driver_performance_cubit.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

/// Repositório de teste: devolve o consolidado sem tocar em rede.
class _FakeRepo implements DriverPerformanceRepository {
  _FakeRepo(this.performance);
  final DriverPerformance performance;

  @override
  Future<DriverPerformance> load({int windowDays = 30}) async => performance;
}

DriverPerformance _perf({
  int delivered = 120,
  int workedDays = 20,
  double? successRate = 0.96,
  double? onTimeRate = 0.82,
  HealthyStreak streak = const HealthyStreak(days: 5, current: true),
  DriverGoal? goal,
  RestAdvice? restAdvice,
}) =>
    DriverPerformance(
      delivered: delivered,
      workedDays: workedDays,
      successRate: successRate,
      onTimeRate: onTimeRate,
      streak: streak,
      goal: goal,
      restAdvice: restAdvice,
    );

Future<void> _pump(WidgetTester tester, DriverPerformance performance) async {
  GetIt.instance.registerFactory<DriverPerformanceCubit>(
    () => DriverPerformanceCubit(_FakeRepo(performance)),
  );
  addTearDown(GetIt.instance.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark(),
      locale: const Locale('pt', 'BR'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const Scaffold(body: DriverPerformanceCard()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('DriverPerformance.fromJson', () {
    test('lê o consolidado com meta e sugestão de descanso', () {
      final p = DriverPerformance.fromJson(const {
        'delivered': 42,
        'workedDays': 9,
        'successRate': 0.95,
        'onTimeRate': 0.8,
        'streak': {'days': 3, 'current': true},
        'goal': {'target': 0.9, 'current': 0.95, 'met': true},
        'restAdvice': {'activeMinutes': 300, 'longDay': true},
      });

      expect(p.delivered, 42);
      expect(p.streak.days, 3);
      expect(p.goal?.met, isTrue);
      expect(p.restAdvice?.longDay, isTrue);
    });

    // `null` e zero são estados diferentes: "0% de sucesso" não é a mesma coisa
    // que "ainda não houve entrega finalizada".
    test('taxa ausente fica nula, não zero', () {
      final p = DriverPerformance.fromJson(const {
        'delivered': 0,
        'workedDays': 0,
        'successRate': null,
        'onTimeRate': null,
        'streak': {'days': 0, 'current': false},
      });

      expect(p.successRate, isNull);
      expect(p.onTimeRate, isNull);
      expect(p.hasData, isFalse);
    });
  });

  group('DriverPerformanceCard', () {
    testWidgets('mostra o consolidado do período', (tester) async {
      await _pump(tester, _perf());

      expect(find.text('120'), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
      expect(find.text('96%'), findsOneWidget);
      expect(find.text('82%'), findsOneWidget);
    });

    // O critério da sequência fica visível: um contador cujo critério ninguém
    // entende é o que faz alguém trabalhar doente com medo de perdê-lo.
    testWidgets('a sequência declara que folga não a quebra', (tester) async {
      await _pump(tester, _perf());

      expect(find.text('5 dias seguidos sem falha'), findsOneWidget);
      expect(
        find.text('Dias de folga não quebram a sequência.'),
        findsOneWidget,
      );
    });

    testWidgets('a meta chega ao leitor de tela como texto', (tester) async {
      await _pump(
        tester,
        _perf(goal: const DriverGoal(target: 0.95, current: 0.96, met: true)),
      );

      expect(find.bySemanticsLabel('Meta: 96% de 95%'), findsOneWidget);
      expect(find.text('Meta cumprida. Agora é manter, não superar.'),
          findsOneWidget);
    });

    testWidgets('sugere pausa após um dia longo', (tester) async {
      await _pump(
        tester,
        _perf(restAdvice: const RestAdvice(activeMinutes: 320, longDay: true)),
      );

      expect(find.text('Você já está na estrada há 5h hoje'), findsOneWidget);
    });

    testWidgets('não sugere pausa em dia curto', (tester) async {
      await _pump(
        tester,
        _perf(restAdvice: const RestAdvice(activeMinutes: 120, longDay: false)),
      );

      expect(find.textContaining('na estrada há'), findsNothing);
    });

    // A ausência é o requisito: nada no cartão compara com outro motorista.
    testWidgets('não exibe ranking, posição nem média da frota', (tester) async {
      await _pump(
        tester,
        _perf(goal: const DriverGoal(target: 0.9, current: 0.96, met: true)),
      );

      final textos = tester
          .widgetList<Text>(find.byType(Text))
          .map((w) => (w.data ?? '').toLowerCase())
          .join(' ');
      for (final proibido in [
        'ranking',
        'posição',
        'média da frota',
        'colegas',
        'por hora',
      ]) {
        expect(textos.contains(proibido), isFalse, reason: proibido);
      }
    });

    testWidgets('período sem dias trabalhados não inventa números',
        (tester) async {
      await _pump(
        tester,
        _perf(
          delivered: 0,
          workedDays: 0,
          successRate: null,
          onTimeRate: null,
          streak: const HealthyStreak(days: 0, current: false),
        ),
      );

      expect(
        find.text('Ainda sem dias trabalhados no período.'),
        findsOneWidget,
      );
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });
  });
}
