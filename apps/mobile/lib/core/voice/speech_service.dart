import 'dart:async';

import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Abstração de reconhecimento (STT) e síntese (TTS) de fala. Mantém a lógica do
/// assistente (cubit) testável sem depender dos plugins nativos (ADR-0037).
abstract class SpeechService {
  /// Inicializa e informa se o reconhecimento está disponível no dispositivo.
  Future<bool> available();

  /// Ouve uma vez e devolve a transcrição final (ou null se nada foi dito).
  Future<String?> listenOnce({required String localeId});

  /// Fala o texto no idioma dado.
  Future<void> speak(String text, {required String localeId});

  /// Interrompe a escuta em curso.
  Future<void> cancel();
}

/// Implementação real com `speech_to_text` (STT) e `flutter_tts` (TTS).
class PluginSpeechService implements SpeechService {
  PluginSpeechService({SpeechToText? stt, FlutterTts? tts})
      : _stt = stt ?? SpeechToText(),
        _tts = tts ?? FlutterTts();

  final SpeechToText _stt;
  final FlutterTts _tts;
  bool _initialized = false;

  @override
  Future<bool> available() async {
    if (_initialized) return _stt.isAvailable;
    _initialized = await _stt.initialize();
    return _initialized;
  }

  @override
  Future<String?> listenOnce({required String localeId}) async {
    if (!await available()) return null;
    final completer = Completer<String?>();

    void finish(String? value) {
      if (!completer.isCompleted) completer.complete(value);
    }

    await _stt.listen(
      listenOptions: SpeechListenOptions(
        localeId: localeId,
        partialResults: false,
        cancelOnError: true,
      ),
      onResult: (SpeechRecognitionResult r) {
        if (r.finalResult) finish(r.recognizedWords.trim());
      },
    );

    // Salvaguarda: encerra a escuta se nenhum resultado final chegar a tempo.
    Timer(const Duration(seconds: 12), () async {
      if (!completer.isCompleted) {
        await _stt.stop();
        finish(_stt.lastRecognizedWords.trim().isEmpty ? null : _stt.lastRecognizedWords.trim());
      }
    });

    final result = await completer.future;
    return (result == null || result.isEmpty) ? null : result;
  }

  @override
  Future<void> speak(String text, {required String localeId}) async {
    await _tts.setLanguage(localeId);
    await _tts.speak(text);
  }

  @override
  Future<void> cancel() async {
    await _stt.stop();
  }
}
