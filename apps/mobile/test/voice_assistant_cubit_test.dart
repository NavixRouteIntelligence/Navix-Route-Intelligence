import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/voice/speech_service.dart';
import 'package:navix_mobile/features/intelligence/data/intelligence_repository.dart';
import 'package:navix_mobile/features/intelligence/domain/voice_command.dart';
import 'package:navix_mobile/features/intelligence/presentation/voice_assistant_cubit.dart';

class _MockRepo extends Mock implements IntelligenceRepository {}

/// Fake configurável de STT/TTS — evita depender dos plugins nativos.
class _FakeSpeech implements SpeechService {
  _FakeSpeech({this.availableResult = true, this.transcript = ''});

  final bool availableResult;
  final String transcript;
  final List<String> spoken = [];

  @override
  Future<bool> available() async => availableResult;

  @override
  Future<String?> listenOnce({required String localeId}) async =>
      transcript.isEmpty ? null : transcript;

  @override
  Future<void> speak(String text, {required String localeId}) async => spoken.add(text);

  @override
  Future<void> cancel() async {}
}

void main() {
  late _MockRepo repo;
  setUp(() => repo = _MockRepo());

  test('voiceReplyFor mapeia intenções conhecidas e o fallback', () {
    expect(voiceReplyFor('next_stop'), contains('próxima parada'));
    expect(voiceReplyFor('mark_delivered'), contains('entregue'));
    expect(voiceReplyFor('qualquer'), contains('Não entendi'));
  });

  blocTest<VoiceAssistantCubit, VoiceAssistantState>(
    'sem suporte: emite unsupported',
    build: () => VoiceAssistantCubit(_FakeSpeech(availableResult: false), repo),
    act: (c) => c.start(),
    expect: () => const [VoiceAssistantState(status: VoiceStatus.unsupported)],
  );

  blocTest<VoiceAssistantCubit, VoiceAssistantState>(
    'fala vazia: listening → idle',
    build: () => VoiceAssistantCubit(_FakeSpeech(transcript: ''), repo),
    act: (c) => c.start(),
    expect: () => const [
      VoiceAssistantState(status: VoiceStatus.listening),
      VoiceAssistantState(status: VoiceStatus.idle),
    ],
  );

  blocTest<VoiceAssistantCubit, VoiceAssistantState>(
    'comando reconhecido: listening → thinking → result e fala a resposta',
    build: () {
      when(() => repo.interpretVoice(any(), locale: any(named: 'locale'))).thenAnswer(
        (_) async => const VoiceCommand(intent: 'next_stop', confidence: 0.8),
      );
      return VoiceAssistantCubit(_FakeSpeech(transcript: 'próxima parada'), repo);
    },
    act: (c) => c.start(),
    expect: () => [
      const VoiceAssistantState(status: VoiceStatus.listening),
      const VoiceAssistantState(status: VoiceStatus.thinking, transcript: 'próxima parada'),
      const VoiceAssistantState(
        status: VoiceStatus.result,
        transcript: 'próxima parada',
        command: VoiceCommand(intent: 'next_stop', confidence: 0.8),
        reply: 'Abrindo a próxima parada.',
      ),
    ],
  );

  blocTest<VoiceAssistantCubit, VoiceAssistantState>(
    'falha na interpretação: emite error',
    build: () {
      when(() => repo.interpretVoice(any(), locale: any(named: 'locale')))
          .thenThrow(const NetworkFailure());
      return VoiceAssistantCubit(_FakeSpeech(transcript: 'oi'), repo);
    },
    act: (c) => c.start(),
    expect: () => [
      const VoiceAssistantState(status: VoiceStatus.listening),
      const VoiceAssistantState(status: VoiceStatus.thinking, transcript: 'oi'),
      const VoiceAssistantState(status: VoiceStatus.error, error: NetworkFailure()),
    ],
  );
}
