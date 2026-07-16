import 'package:equatable/equatable.dart';

/// Intenção reconhecida de um comando de voz (ADR-0032/0037). A classificação é
/// feita no backend (`VoiceCommandInterpreterPort`); o app só orquestra STT/TTS.
class VoiceCommand extends Equatable {
  const VoiceCommand({
    required this.intent,
    required this.confidence,
    this.parkingDifficulty,
  });

  final String intent; // next_stop | route_summary | remaining | mark_delivered | report_parking | help | unknown
  final double confidence;
  final String? parkingDifficulty; // slot de report_parking

  @override
  List<Object?> get props => [intent, confidence, parkingDifficulty];
}
