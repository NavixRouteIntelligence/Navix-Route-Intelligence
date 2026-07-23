import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../../../core/voice/speech_service.dart';
import '../data/intelligence_repository.dart';
import '../domain/voice_command.dart';

/// Resposta falada por intenção (pt-BR). O texto vive no cliente; o backend só
/// devolve a intenção estruturada (ADR-0032/0037).
String voiceReplyFor(String intent) {
  switch (intent) {
    case 'next_stop':
      return 'Abrindo a próxima parada.';
    case 'route_summary':
      return 'Aqui está o resumo da rota.';
    case 'remaining':
      return 'Calculando quanto falta.';
    case 'mark_delivered':
      return 'Marcando a parada como entregue.';
    case 'report_parking':
      return 'Registrando o estacionamento.';
    case 'help':
      return 'Você pode pedir: próxima parada, resumo, quanto falta, marcar entregue ou reportar estacionamento.';
    default:
      return 'Não entendi. Diga ajuda para ver os comandos.';
  }
}

enum VoiceStatus { idle, listening, thinking, result, unsupported, error }

class VoiceAssistantState extends Equatable {
  const VoiceAssistantState({
    this.status = VoiceStatus.idle,
    this.transcript,
    this.command,
    this.reply,
    this.error,
  });

  final VoiceStatus status;
  final String? transcript;
  final VoiceCommand? command;
  final String? reply;
  final Failure? error;

  VoiceAssistantState copyWith({VoiceStatus? status, String? transcript, VoiceCommand? command, String? reply, Failure? error}) {
    return VoiceAssistantState(
      status: status ?? this.status,
      transcript: transcript ?? this.transcript,
      command: command ?? this.command,
      reply: reply ?? this.reply,
      error: error ?? this.error,
    );
  }

  @override
  List<Object?> get props => [status, transcript, command, reply, error];
}

/// Orquestra o assistente por voz: ouve (STT), classifica a intenção no backend
/// e responde por voz (TTS). Silencioso em erro para não atrapalhar a operação.
class VoiceAssistantCubit extends Cubit<VoiceAssistantState> {
  VoiceAssistantCubit(this._speech, this._repository) : super(const VoiceAssistantState());

  final SpeechService _speech;
  final IntelligenceRepository _repository;

  static const String sttLocale = 'pt_BR';
  static const String ttsLocale = 'pt-BR';

  Future<void> start() async {
    if (state.status == VoiceStatus.listening || state.status == VoiceStatus.thinking) return;

    if (!await _speech.available()) {
      emit(const VoiceAssistantState(status: VoiceStatus.unsupported));
      return;
    }

    emit(const VoiceAssistantState(status: VoiceStatus.listening));
    try {
      final transcript = await _speech.listenOnce(localeId: sttLocale);
      if (transcript == null || transcript.isEmpty) {
        emit(const VoiceAssistantState(status: VoiceStatus.idle));
        return;
      }

      emit(VoiceAssistantState(status: VoiceStatus.thinking, transcript: transcript));
      final command = await _repository.interpretVoice(transcript, locale: ttsLocale);
      final reply = voiceReplyFor(command.intent);
      emit(VoiceAssistantState(
        status: VoiceStatus.result,
        transcript: transcript,
        command: command,
        reply: reply,
      ));
      await _speech.speak(reply, localeId: ttsLocale);
    } on Failure catch (f) {
      emit(VoiceAssistantState(status: VoiceStatus.error, error: f));
    } catch (_) {
      emit(const VoiceAssistantState(status: VoiceStatus.error, error: UnknownFailure()));
    }
  }

  @override
  Future<void> close() async {
    await _speech.cancel();
    return super.close();
  }
}
