import 'package:flutter/material.dart';

import '../../core/ui/navix_states.dart';
import '../../l10n/gen/app_localizations.dart';

/// Tela placeholder reutilizável para itens de menu ainda sem funcionalidade
/// (Estatísticas, Notificações, Configurações). Honesta: usa o estado vazio do
/// design system, sem inventar lógica de negócio.
class ComingSoonPage extends StatelessWidget {
  const ComingSoonPage({required this.title, required this.icon, super.key});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: NavixEmptyState(
        icon: icon,
        title: title,
        description: l10n.comingSoon,
      ),
    );
  }
}
