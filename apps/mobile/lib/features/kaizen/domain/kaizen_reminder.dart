import '../../../l10n/gen/app_localizations.dart';

/// Lembrete opcional do resumo (ADR-0124).
///
/// Duas coisas vivem aqui, e nenhuma delas é a entrega da notificação: **quando**
/// ela deveria disparar, e **o que** pode dizer. As duas são puras, e por isso
/// testáveis sem plugin, sem permissão e sem relógio da máquina.
///
/// A entrega em si — `flutter_local_notifications`, permissão, agendamento
/// nativo — não está implementada: o repositório não tem as pastas `android/`
/// nem `ios/` na `main`, e não há onde pôr a configuração que o plugin exige.
/// Escrever o adaptador sem elas produziria código que não corre e não se
/// verifica, que é pior do que não o ter.
class KaizenReminder {
  const KaizenReminder._();

  /// Próximo instante local em que o lembrete deve disparar.
  ///
  /// `hhmm` vem da preferência do servidor (`HH:MM`, hora **local**). Se a hora
  /// de hoje já passou, é amanhã — nunca «daqui a um minuto» para compensar,
  /// que transformaria um lembrete perdido numa interrupção.
  static DateTime? nextOccurrence(String? hhmm, DateTime now) {
    if (hhmm == null) return null;
    final match = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(hhmm);
    if (match == null) return null;

    final hora = int.parse(match.group(1)!);
    final minuto = int.parse(match.group(2)!);
    final hoje = DateTime(now.year, now.month, now.day, hora, minuto);
    return hoje.isAfter(now) ? hoje : hoje.add(const Duration(days: 1));
  }

  /// Título e corpo da notificação.
  ///
  /// **Nenhum número do dia entra aqui.** Ecrã bloqueado é ecrã público: quem
  /// olha para o telemóvel pousado na mesa não tem de saber quantas entregas a
  /// pessoa concluiu, nem quanto tempo esteve na rua. A notificação convida a
  /// abrir; o conteúdo fica atrás da autenticação.
  static ({String title, String body}) content(AppLocalizations l10n) =>
      (title: l10n.kaizenReminderTitle, body: l10n.kaizenReminderBody);
}
