import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/kaizen/data/kaizen_repository.dart';
import 'package:navix_mobile/features/kaizen/domain/kaizen_summary.dart';
import 'package:navix_mobile/features/kaizen/presentation/kaizen_cubit.dart';
import 'package:navix_mobile/features/kaizen/presentation/kaizen_daily_page.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

/// Repositório de teste: devolve o resumo sem tocar em rede.
class _FakeRepo implements KaizenRepository {
  _FakeRepo({this.daily, this.erro});

  final KaizenDaily? daily;
  final Failure? erro;

  @override
  Future<KaizenDaily?> loadDaily({String? day}) async {
    if (erro != null) throw erro!;
    return daily;
  }
}

KaizenDaily _daily({
  String status = 'ok',
  int delivered = 14,
  int failed = 0,
  int onTime = 14,
  double? baseline = 12,
  String? trend = 'stable',
  String? code = 'none.acknowledge',
  double? km,
}) =>
    KaizenDaily(
      day: '2026-08-08',
      status: status,
      delivered: delivered,
      failed: failed,
      onTime: onTime,
      baselineDelivered: baseline,
      baselineSample: 7,
      baselineTrend: trend,
      recommendationCode: code,
      recommendationKm: km,
    );

Future<void> _pump(WidgetTester tester, {double textScale = 1.0}) async {
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('pt', 'PT'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const KaizenDailyPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  final getIt = GetIt.instance;

  void registar(_FakeRepo repo) {
    if (getIt.isRegistered<KaizenCubit>()) getIt.unregister<KaizenCubit>();
    getIt.registerFactory<KaizenCubit>(() => KaizenCubit(repo));
  }

  tearDown(() => getIt.reset());

  group('estados', () {
    testWidgets('dia completo mostra os três cartões', (tester) async {
      registar(_FakeRepo(daily: _daily()));

      await _pump(tester);

      expect(find.text('Ontem em números'), findsOneWidget);
      expect(find.text('Em relação aos seus últimos dias'), findsOneWidget);
      expect(find.text('Kaizen de hoje'), findsOneWidget);
    });

    // Um bloco só: mostrar cartões de números vazios ao lado seria apresentar
    // ausência de dado como resultado.
    testWidgets('pouco histórico mostra um bloco e nenhum cartão de números',
        (tester) async {
      registar(_FakeRepo(daily: _daily(trend: 'building-history')));

      await _pump(tester);

      expect(find.text('Ontem em números'), findsNothing);
      expect(
        find.text(
          'Com mais dias de trabalho registados, este resumo passa a mostrar a sua evolução.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('dia sem rota diz-se, sem números', (tester) async {
      registar(
          _FakeRepo(daily: _daily(status: 'no-work', delivered: 0, onTime: 0)));

      await _pump(tester);

      expect(find.text('Ontem em números'), findsNothing);
      expect(find.text('Não registou entregas'), findsOneWidget);
    });

    testWidgets('projeção pendente pede para voltar, sem inventar zeros',
        (tester) async {
      registar(
          _FakeRepo(daily: _daily(status: 'pending', delivered: 0, onTime: 0)));

      await _pump(tester);

      expect(find.textContaining('ainda está a ser preparado'), findsOneWidget);
    });

    testWidgets('sem resumo nenhum, estado vazio', (tester) async {
      registar(_FakeRepo(daily: null));

      await _pump(tester);

      expect(find.textContaining('não há um dia de trabalho'), findsOneWidget);
    });

    // Sem rede não há nada partido: oferecer «tentar de novo» seria pedir uma
    // ação que não pode resultar.
    testWidgets('offline não oferece tentar de novo', (tester) async {
      registar(_FakeRepo(erro: const NetworkFailure()));

      await _pump(tester);

      expect(find.textContaining('Sem ligação'), findsOneWidget);
      expect(find.text('Tentar de novo'), findsNothing);
    });

    testWidgets('erro oferece tentar de novo', (tester) async {
      registar(_FakeRepo(erro: const ServerFailure()));

      await _pump(tester);

      expect(find.text('Não foi possível carregar o resumo'), findsOneWidget);
      expect(find.text('Tentar de novo'), findsOneWidget);
    });
  });

  group('números', () {
    testWidgets('as taxas saem em percentagem', (tester) async {
      registar(_FakeRepo(daily: _daily(delivered: 6, failed: 2, onTime: 3)));

      await _pump(tester);

      expect(find.text('75%'), findsOneWidget); // 6 de 8 finalizadas
      expect(find.text('50%'), findsOneWidget); // 3 de 6 entregues
    });

    // «0%» seria um facto inventado onde não há denominador.
    testWidgets('sem denominador, diz "sem registo" em vez de 0%',
        (tester) async {
      registar(_FakeRepo(daily: _daily(delivered: 0, failed: 0, onTime: 0)));

      await _pump(tester);

      expect(find.text('0%'), findsNothing);
      expect(find.text('sem registo'), findsWidgets);
    });

    testWidgets('sem distância, a rota mais curta não aparece', (tester) async {
      registar(_FakeRepo(daily: _daily()));

      await _pump(tester);

      expect(find.text('Rota sugerida mais curta'), findsNothing);
    });

    testWidgets('com distância, aparece como diferença em km', (tester) async {
      registar(_FakeRepo(
        daily: _daily(code: 'load.follow-suggested-order', km: 12.4),
      ));

      await _pump(tester);

      expect(find.text('12,4 km'), findsOneWidget);
    });
  });

  group('acessibilidade', () {
    testWidgets('o resumo inteiro é lido numa etiqueta só', (tester) async {
      final handle = tester.ensureSemantics();
      registar(_FakeRepo(daily: _daily()));

      await _pump(tester);

      final etiqueta = find.bySemanticsLabel(RegExp(r'^Resumo de 2026-08-08'));
      expect(etiqueta, findsOneWidget);
      expect(
        tester.getSemantics(etiqueta).label,
        contains('Concluiu 14 entregas'),
      );
      handle.dispose();
    });

    testWidgets('cada número é anunciado com o seu rótulo', (tester) async {
      final handle = tester.ensureSemantics();
      registar(_FakeRepo(daily: _daily(delivered: 14)));

      await _pump(tester);

      // O cartão funde os nós dos filhos numa etiqueta só; o que importa é o
      // número sair sempre acompanhado do seu rótulo, e nunca sozinho.
      expect(find.bySemanticsLabel(RegExp(r'Concluídas: 14')), findsOneWidget);
      handle.dispose();
    });

    // Dynamic Type grande não pode truncar nem estourar o layout.
    testWidgets('sobrevive a texto no dobro do tamanho', (tester) async {
      registar(_FakeRepo(daily: _daily()));

      await _pump(tester, textScale: 2.0);

      expect(tester.takeException(), isNull);
      expect(find.text('Ontem em números'), findsOneWidget);
    });
  });

  group('o que a tela recusa mostrar', () {
    testWidgets('nenhum ranking, score ou cobrança', (tester) async {
      registar(_FakeRepo(daily: _daily(delivered: 6, failed: 2, onTime: 4)));

      await _pump(tester);

      final textos = tester
          .widgetList<Text>(find.byType(Text))
          .map((t) => (t.data ?? '').toLowerCase())
          .join(' ');
      for (final proibido in [
        'ranking',
        'posição',
        'score',
        'pontuação',
        'média da frota',
        'no prazo',
        'recuperar',
        'meta',
      ]) {
        expect(textos.contains(proibido), isFalse,
            reason: 'apareceu "$proibido"');
      }
    });
  });

  group('saudação e data', () {
    testWidgets('a saudação segue a hora — «Bom dia» às 20h seria errado',
        (tester) async {
      registar(_FakeRepo(daily: _daily()));
      await _pump(tester);
      final l10n =
          AppLocalizations.of(tester.element(find.byType(KaizenDailyPage)));

      expect(kaizenGreeting(l10n, DateTime(2026, 8, 9, 8)), 'Bom dia');
      expect(kaizenGreeting(l10n, DateTime(2026, 8, 9, 15)), 'Boa tarde');
      expect(kaizenGreeting(l10n, DateTime(2026, 8, 9, 21)), 'Boa noite');
    });

    testWidgets('a data é lida, não é o identificador', (tester) async {
      registar(_FakeRepo(daily: _daily()));

      await _pump(tester);

      expect(find.text('2026-08-08'), findsNothing);
      expect(find.textContaining('agosto'), findsOneWidget);
    });

    test('data inválida devolve o que recebeu, sem rebentar', () {
      expect(kaizenReadableDay('ontem', 'pt_PT'), 'ontem');
    });
  });
}
