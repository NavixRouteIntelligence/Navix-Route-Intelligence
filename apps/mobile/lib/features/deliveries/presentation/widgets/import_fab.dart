import 'package:flutter/material.dart';

import '../../../../l10n/gen/app_localizations.dart';

/// FAB "Importar" da aba Entregas do Motorista (S2). Widget fino e sem
/// dependências de DI — a navegação/recarga vive na página (via [onPressed]),
/// o que mantém este widget testável isoladamente.
class ImportFab extends StatelessWidget {
  const ImportFab({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FloatingActionButton.extended(
      // Ver nota em VoiceAssistantButton: tags de Hero únicas por aba.
      heroTag: 'fab-import',
      onPressed: onPressed,
      icon: const Icon(Icons.upload_file_outlined),
      label: Text(l10n.importAction),
      tooltip: l10n.importAction,
    );
  }
}
