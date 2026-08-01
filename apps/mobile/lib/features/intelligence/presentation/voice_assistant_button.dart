import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/theme/navix_tokens.dart';
import 'voice_assistant_cubit.dart';

/// Botão do assistente por voz (ADR-0037): dispara a escuta e reflete o estado
/// (ouvindo/pensando). Requer um [VoiceAssistantCubit] no contexto.
class VoiceAssistantButton extends StatelessWidget {
  const VoiceAssistantButton({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return BlocBuilder<VoiceAssistantCubit, VoiceAssistantState>(
      builder: (context, state) {
        final busy = state.status == VoiceStatus.listening ||
            state.status == VoiceStatus.thinking;
        final label = switch (state.status) {
          VoiceStatus.listening => 'Ouvindo…',
          VoiceStatus.thinking => 'Processando…',
          _ => 'Falar',
        };
        final onPressed =
            busy ? null : () => context.read<VoiceAssistantCubit>().start();
        final background =
            busy ? t.danger : Theme.of(context).colorScheme.primary;
        final icon = Icon(busy ? Icons.mic : Icons.mic_none_outlined);

        if (compact) {
          return FloatingActionButton.small(
            // Tag única: as abas vivem juntas num IndexedStack, e FABs com a tag
            // padrão colidem no Hero ao animar uma rota (ex.: abrir o Drawer).
            heroTag: 'fab-voice-assistant',
            tooltip: label,
            onPressed: onPressed,
            backgroundColor: background,
            child: icon,
          );
        }

        return FloatingActionButton.extended(
          heroTag: 'fab-voice-assistant',
          onPressed: onPressed,
          backgroundColor: background,
          icon: icon,
          label: Text(label),
        );
      },
    );
  }
}
