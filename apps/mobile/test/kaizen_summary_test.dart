import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/kaizen/domain/kaizen_summary.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

/// Guarda as secções 1, 4 e 5 do contrato de linguagem
/// (`docs/modules/kaizen-contrato-linguagem.md`).
///
/// A secção 1 diz quais blocos existem, em que ordem, e que um bloco sem dado
/// **não aparece**. A secção 4 dá exemplos aprovados — aqui eles deixam de ser
/// ilustração e passam a ser o resultado esperado. A secção 5 proíbe apresentar
/// estimativa como resultado.
void main() {
  late AppLocalizations pt;

  setUpAll(() async {
    pt = await AppLocalizations.delegate.load(const Locale('pt', 'PT'));
  });

  Map<String, dynamic> payload({
    String status = 'ok',
    int delivered = 14,
    int failed = 0,
    int onTime = 14,
    double? baseline = 12,
    int sample = 7,
    String? trend = 'stable',
    Map<String, dynamic>? recommendation,
  }) =>
      {
        'day': '2026-08-08',
        'status': status,
        'metrics': {'delivered': delivered, 'failed': failed, 'onTime': onTime},
        if (trend != null)
          'baseline': {
            'delivered': {'current': delivered, 'baseline': baseline, 'trend': trend, 'sample': sample},
          },
        if (recommendation != null) 'recommendation': recommendation,
      };

  List<KaizenBlock> compor(Map<String, dynamic> json) =>
      composeKaizenSummary(KaizenDaily.fromJson(json), pt);

  group('secção 1 — quais blocos, e em que ordem', () {
    test('um dia completo tem os quatro blocos, nesta ordem', () {
      final blocos = compor(payload(
        recommendation: {'code': 'none.acknowledge', 'evidence': [], 'action': null},
      ));

      expect(blocos.map((b) => b.kind), [
        KaizenBlockKind.yesterday,
        KaizenBlockKind.comparison,
        KaizenBlockKind.why,
        KaizenBlockKind.today,
      ]);
    });

    // A regra que mais importa: um «—» no lugar da comparação parece um facto.
    test('sem histórico, aparece um bloco só', () {
      final blocos = compor(payload(trend: 'building-history'));

      expect(blocos, hasLength(1));
      expect(blocos.single.body, pt.kaizenWhyBuildingHistory);
    });

    test('sem baseline nenhum, também um bloco só', () {
      expect(compor(payload(trend: null)), hasLength(1));
    });

    test('dia de folga: um bloco, e mais nada', () {
      final blocos = compor(payload(status: 'no-work', delivered: 0, onTime: 0));

      expect(blocos, hasLength(1));
      expect(blocos.single.body, pt.kaizenTitleNoWork);
    });

    test('projeção pendente diz-se, não se mostra como dia vazio', () {
      final blocos = compor(payload(status: 'pending', delivered: 0, onTime: 0));

      expect(blocos.single.body, pt.kaizenPreparing);
    });
  });

  group('secção 4 — os exemplos aprovados são o resultado esperado', () {
    test('4.1 — dia com dados completos', () {
      final blocos = compor(payload(
        delivered: 14,
        onTime: 14,
        baseline: 12,
        sample: 7,
        trend: 'stable',
        recommendation: {'code': 'none.acknowledge', 'evidence': [], 'action': null},
      ));

      expect(blocos[0].toString(), 'Ontem\nConcluiu 14 entregas. Todas dentro da janela combinada.');
      expect(
        blocos[1].toString(),
        'Em relação às suas últimas semanas\n'
        'Nos seus últimos 7 dias de trabalho, o costume foi 12 entregas. '
        'Ontem ficou em linha com o seu costume.',
      );
      expect(blocos[3].toString(), 'Para hoje\nNada a sugerir.');
    });

    test('4.2 — dia com entregas por concluir e sem motivo registado', () {
      final blocos = compor(payload(
        delivered: 6,
        failed: 2,
        onTime: 6,
        baseline: 12,
        trend: 'attention',
        recommendation: {'code': 'failures.repeated', 'evidence': [], 'action': {'kind': 'review-failed-deliveries', 'count': 2}},
      ));

      expect(blocos[0].body, 'Concluiu 6 entregas. Ficaram 2 por concluir.');
      expect(blocos[2].body, 'Ontem ficaram 2 entregas por concluir.');
      expect(blocos[3].body, 'Se fizer sentido, reveja antes de sair o que ficou por concluir.');
    });

    test('4.2 — sem código de recomendação, o porquê é "não sabemos"', () {
      final blocos = compor(payload(delivered: 6, failed: 2, onTime: 6, trend: 'stable'));

      expect(blocos[2].body, 'Não sabemos.');
      expect(blocos[3].body, 'Nada a sugerir.');
    });

    test('4.3 — sem histórico suficiente', () {
      expect(compor(payload(trend: 'building-history')).single.body,
          'Com mais dias de trabalho registados, este resumo passa a mostrar a sua evolução.');
    });

    test('4.4 — dia de folga', () {
      expect(compor(payload(status: 'no-work', delivered: 0, onTime: 0)).single.body,
          'Não registou entregas');
    });

    // O que os exemplos NÃO dizem é metade do contrato.
    test('nenhum bloco pergunta o que correu mal nem promete recuperar', () {
      final proibido = RegExp(r'recuperar|o que correu mal|vamos|acumulad', caseSensitive: false);

      for (final caso in [
        payload(delivered: 6, failed: 2, onTime: 6, trend: 'attention'),
        payload(status: 'no-work', delivered: 0, onTime: 0),
        payload(trend: 'building-history'),
      ]) {
        for (final b in compor(caso)) {
          expect(proibido.hasMatch(b.body), isFalse, reason: b.body);
        }
      }
    });
  });

  group('secção 5 — estimativa nunca é resultado', () {
    test('a distância é diferença face à ordem de origem, não poupança', () {
      final blocos = compor(payload(
        recommendation: {
          'code': 'load.follow-suggested-order',
          'evidence': [
            {'metric': 'savedKm', 'value': 12.4},
          ],
          'action': {'kind': 'load-in-route-order'},
        },
      ));

      expect(blocos[2].body,
          'A rota sugerida era 12,4 km mais curta do que a ordem em que as paragens entraram.');
      expect(blocos[2].body.toLowerCase(), isNot(contains('poupou')));
    });

    test('nenhum bloco fala em dinheiro nem em combustível poupado', () {
      final proibido = RegExp(r'€|euro|poupou|poupança|litros?\b', caseSensitive: false);

      for (final caso in [
        payload(recommendation: {
          'code': 'load.follow-suggested-order',
          'evidence': [
            {'metric': 'savedKm', 'value': 50},
          ],
          'action': {'kind': 'load-in-route-order'},
        }),
        payload(recommendation: {'code': 'none.acknowledge', 'evidence': [], 'action': null}),
      ]) {
        for (final b in compor(caso)) {
          expect(proibido.hasMatch(b.body), isFalse, reason: b.body);
        }
      }
    });
  });

  group('descanso', () {
    test('um dia longo explica-se com a duração, e a ação é preparar', () {
      final blocos = compor(payload(
        recommendation: {
          'code': 'rest.long-day',
          'evidence': [
            {'metric': 'activeMinutes', 'value': 320},
          ],
          'action': {'kind': 'plan-shorter-day'},
        },
      ));

      expect(blocos[2].body, 'O período entre a primeira e a última atividade foi de 5h20.');
      expect(blocos[3].body, 'Se fizer sentido, planeie hoje um dia mais curto.');
    });

    test('mais longo do que o costume compara com a própria referência', () {
      final blocos = compor(payload(
        recommendation: {
          'code': 'rest.longer-than-usual',
          'evidence': [
            {'metric': 'activeMinutes', 'value': 260, 'baseline': 180},
          ],
          'action': {'kind': 'plan-shorter-day'},
        },
      ));

      expect(blocos[2].body, contains('4h20'));
      expect(blocos[2].body, contains('3h00'));
    });
  });
}
