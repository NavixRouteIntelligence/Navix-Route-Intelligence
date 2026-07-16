import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/theme/navix_tokens.dart';
import 'voice_assistant_cubit.dart';

/// Botão do assistente por voz (ADR-0037): dispara a escuta e reflete o estado
/// (ouvindo/pensando). Requer um [VoiceAssistantCubit] no contexto.
class VoiceAssistantButton extends StatelessWidget {
  const VoiceAssistantButton({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return BlocBuilder<VoiceAssistantCubit, VoiceAssistantState>(
      builder: (context, state) {
        final busy = state.status == VoiceStatus.listening || state.status == VoiceStatus.thinking;
        final label = switch (state.status) {
          VoiceStatus.listening => 'Ouvindo…',
          VoiceStatus.thinking => 'Processando…',
          _ => 'Falar',
        };
        return FloatingActionButton.extended(
          onPressed: busy ? null : () => context.read<VoiceAssistantCubit>().start(),
          backgroundColor: busy ? t.danger : Theme.of(context).colorScheme.primary,
          icon: Icon(busy ? Icons.mic : Icons.mic_none_outlined),
          label: Text(label),
        );
      },
    );
  }
}
