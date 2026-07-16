import 'package:equatable/equatable.dart';

/// Previsão de estacionamento no destino (ADR-0029), já ciente da comunidade
/// no backend (ADR-0034).
class ParkingPrediction extends Equatable {
  const ParkingPrediction({
    required this.difficulty,
    required this.confidence,
    required this.walkMinutes,
  });

  final String difficulty; // easy | moderate | hard
  final double confidence;
  final int walkMinutes;

  @override
  List<Object?> get props => [difficulty, confidence, walkMinutes];
}

/// Insight da inteligência coletiva do tenant para um local (ADR-0031).
class CollectiveInsight extends Equatable {
  const CollectiveInsight({
    required this.sampleSize,
    this.parkingDifficulty,
    this.typicalServiceMinutes,
    this.accessTips = const [],
  });

  final int sampleSize;
  final String? parkingDifficulty;
  final double? typicalServiceMinutes;
  final List<String> accessTips;

  bool get hasSignal =>
      parkingDifficulty != null || typicalServiceMinutes != null || accessTips.isNotEmpty;

  @override
  List<Object?> get props => [sampleSize, parkingDifficulty, typicalServiceMinutes, accessTips];
}

/// Inteligência da parada atual: previsão + acesso + coletiva (ADR-0028/0029/0031).
class StopIntelligence extends Equatable {
  const StopIntelligence({
    this.parking,
    this.access = const [],
    this.insight,
  });

  final ParkingPrediction? parking;
  final List<String> access; // textos das instruções de acesso
  final CollectiveInsight? insight;

  @override
  List<Object?> get props => [parking, access, insight];
}
