import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/kaizen/domain/kaizen_reminder.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

void main() {
  group('nextOccurrence', () {
    final agora = DateTime(2026, 8, 9, 10, 0);

    test('sem hora escolhida, não há lembrete', () {
      expect(KaizenReminder.nextOccurrence(null, agora), isNull);
    });

    test('hora ainda por vir hoje: hoje', () {
      expect(
        KaizenReminder.nextOccurrence('18:30', agora),
        DateTime(2026, 8, 9, 18, 30),
      );
    });

    // Nunca «daqui a um minuto» para compensar: um lembrete perdido não deve
    // virar interrupção.
    test('hora já passada: amanhã, não já a seguir', () {
      expect(
        KaizenReminder.nextOccurrence('07:00', agora),
        DateTime(2026, 8, 10, 7, 0),
      );
    });

    test('a hora exata conta como passada', () {
      expect(
        KaizenReminder.nextOccurrence('10:00', agora),
        DateTime(2026, 8, 10, 10, 0),
      );
    });

    test('atravessa o fim do mês', () {
      final fim = DateTime(2026, 8, 31, 23, 0);

      expect(
        KaizenReminder.nextOccurrence('07:00', fim),
        DateTime(2026, 9, 1, 7, 0),
      );
    });

    test('hora malformada não agenda nada', () {
      for (final hora in ['7:00', '24:00', '07:60', 'manhã', '']) {
        expect(KaizenReminder.nextOccurrence(hora, agora), isNull,
            reason: hora);
      }
    });
  });

  group('conteúdo da notificação', () {
    late AppLocalizations pt;

    setUpAll(() async {
      pt = await AppLocalizations.delegate.load(const Locale('pt', 'PT'));
    });

    // O critério de aceite da T7.8: ecrã bloqueado é ecrã público.
    test('não contém número nenhum do dia', () {
      final c = KaizenReminder.content(pt);

      expect(RegExp(r'\d').hasMatch(c.title), isFalse, reason: c.title);
      expect(RegExp(r'\d').hasMatch(c.body), isFalse, reason: c.body);
    });

    test('não contém termo de métrica nem de cobrança', () {
      final c = KaizenReminder.content(pt);
      final texto = '${c.title} ${c.body}'.toLowerCase();

      for (final proibido in [
        'entregas',
        'concluí',
        'falha',
        'pontualidade',
        'no prazo',
        'meta',
        'recuperar',
        'atras',
      ]) {
        expect(texto.contains(proibido), isFalse, reason: proibido);
      }
    });

    test('convida a abrir, e é só isso', () {
      final c = KaizenReminder.content(pt);

      expect(c.title, 'O resumo de ontem está pronto');
      expect(c.body, contains('Toque'));
    });
  });
}
