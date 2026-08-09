import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guarda a secção 3 do contrato de linguagem do Kaizen
/// (`docs/modules/kaizen-contrato-linguagem.md`).
///
/// A secção proíbe um conjunto de palavras e de tons. Enquanto isso viveu só
/// no documento, era uma recomendação: qualquer tradução futura podia
/// reintroduzi-los sem que ninguém reparasse — e «no prazo» é, em qualquer
/// língua, a porta de entrada da pressão.
///
/// Este teste transforma a proibição em falha de CI. Cobre as chaves `kaizen*`
/// de todas as locales, incluindo as que ainda não foram traduzidas: quando
/// forem, a rede já está montada.
void main() {
  final arbDir = Directory('lib/l10n/arb');

  /// Termos proibidos pela secção 3 e pela coluna «nunca se diz» da secção 2.
  /// A chave é o termo; o valor, a razão — para o vermelho explicar-se sozinho.
  const proibidos = <String, String>{
    r'produtividade': 'secção 2: diz-se «entregas concluídas»',
    r'output': 'secção 2: diz-se «entregas concluídas»',
    r'insucess': 'secção 2: diz-se «entregas por concluir»',
    r'no prazo': 'secção 2: diz-se «dentro da janela combinada»',
    r'pontualidade': 'secção 2: diz-se «dentro da janela combinada»',
    r'\bsla\b': 'secção 2: jargão de contrato, não de quem entrega',
    r'rota ideal': 'secção 2: diz-se «rota sugerida»',
    r'rota certa': 'secção 2: diz-se «rota sugerida»',
    r'incumprimento': 'secção 2: diz-se «diferente do previsto»',
    r'horas trabalhadas': 'secção 2: diz-se «período de atividade»',
    r'\bjornada\b': 'secção 2: diz-se «período de atividade»',
    r'ranking': 'secção 3: não há comparação com terceiros',
    r'percentil': 'secção 3: não há comparação com terceiros',
    r'velocidade': 'secção 3: incentivo a correr',
    r'km/h': 'secção 3: incentivo a correr',
    r'entregas por hora': 'secção 3: taxa com tempo no denominador',
    r'mais depressa': 'secção 3: incentivo a correr',
    r'mais rápido': 'secção 3: incentivo a correr',
    r'não cumpriu': 'secção 3: culpa',
    r'ficou aquém': 'secção 3: culpa',
    r'devia ter': 'secção 3: culpa',
    r'poupou': 'secção 5: estimativa apresentada como resultado',
  };

  Map<String, String> kaizenStrings(File f) {
    final json = jsonDecode(f.readAsStringSync()) as Map<String, dynamic>;
    return {
      for (final e in json.entries)
        if (e.key.startsWith('kaizen') && e.value is String)
          e.key: e.value as String,
    };
  }

  test('as locales trazem strings kaizen para o contrato guardar', () {
    final total = arbDir
        .listSync()
        .whereType<File>()
        .map((f) => kaizenStrings(f).length)
        .fold<int>(0, (a, b) => a + b);

    expect(total, greaterThan(0));
  });

  for (final file in arbDir.listSync().whereType<File>()) {
    final nome = file.uri.pathSegments.last;
    final strings = kaizenStrings(file);
    if (strings.isEmpty) continue;

    group('contrato de linguagem — $nome', () {
      test('nenhum termo proibido', () {
        for (final entry in strings.entries) {
          final texto = entry.value.toLowerCase();
          for (final proibido in proibidos.entries) {
            expect(
              RegExp(proibido.key).hasMatch(texto),
              isFalse,
              reason:
                  '"${entry.key}" contém termo proibido /${proibido.key}/ — ${proibido.value}',
            );
          }
        }
      });

      // Secção 2: «Sem exclamação. Sem emoji de celebração, de alerta ou de
      // fogo. O resumo informa; não anima nem repreende.»
      test('sem exclamação e sem emoji', () {
        for (final entry in strings.entries) {
          expect(entry.value.contains('!'), isFalse,
              reason: '"${entry.key}" tem exclamação — secção 2');
          expect(
            RegExp(r'[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true)
                .hasMatch(entry.value),
            isFalse,
            reason: '"${entry.key}" tem emoji — secção 2',
          );
        }
      });

      // Secção 3: o imperativo só é admitido na ação sugerida, e sempre com
      // escape. Uma ação sem escape lê-se como ordem.
      test('as ações sugeridas trazem o escape', () {
        final escapes = ['se fizer sentido', 'if it makes sense'];
        for (final entry in strings.entries) {
          if (!entry.key.startsWith('kaizenAction')) continue;
          expect(
            escapes.any((e) => entry.value.toLowerCase().contains(e)),
            isTrue,
            reason: '"${entry.key}" é uma ação sem escape — lê-se como ordem',
          );
        }
      });
    });
  }
}
