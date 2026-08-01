import 'package:equatable/equatable.dart';

/// Estado efetivo de um motorista no rastreamento.
enum TrackStatus { enRoute, stopped, offline, finished }

TrackStatus trackStatusFrom(String? raw, {double? speedKmh}) {
  switch (raw) {
    case 'en_route':
      // Em rota, mas praticamente parado → destaca como "parado".
      if (speedKmh != null && speedKmh < 2) return TrackStatus.stopped;
      return TrackStatus.enRoute;
    case 'finished':
      return TrackStatus.finished;
    default:
      return TrackStatus.offline;
  }
}

/// Um motorista rastreado (posição mais recente + identidade).
class TrackedDriver extends Equatable {
  const TrackedDriver({
    required this.id,
    required this.name,
    required this.status,
    this.latitude,
    this.longitude,
    this.speedKmh,
    this.recordedAt,
    this.plate,
  });

  final String id;
  final String name;
  final TrackStatus status;
  final double? latitude;
  final double? longitude;
  final double? speedKmh;
  final DateTime? recordedAt;
  final String? plate;

  bool get hasPosition => latitude != null && longitude != null;
  bool get isOnline =>
      status == TrackStatus.enRoute || status == TrackStatus.stopped;

  /// Segundos desde a última posição (null se nunca reportou).
  int? get ageSeconds => recordedAt == null
      ? null
      : DateTime.now().difference(recordedAt!).inSeconds;

  /// GPS instável: online mas sem atualização há mais de 90s.
  bool get gpsStale => isOnline && (ageSeconds ?? 0) > 90;

  @override
  List<Object?> get props => [
        id,
        name,
        status,
        latitude,
        longitude,
        speedKmh,
        recordedAt,
        plate,
      ];
}

/// Um ponto do histórico de posições (timeline).
class TrackPoint extends Equatable {
  const TrackPoint({
    required this.recordedAt,
    required this.status,
    this.speedKmh,
  });

  final DateTime recordedAt;
  final TrackStatus status;
  final double? speedKmh;

  @override
  List<Object?> get props => [recordedAt, status, speedKmh];
}

/// Instantâneo da frota.
class FleetSnapshot extends Equatable {
  const FleetSnapshot({
    required this.drivers,
    this.updatedAt,
    this.risks = const [],
  });

  final List<TrackedDriver> drivers;
  final DateTime? updatedAt;

  /// Riscos previstos de estouro de janela (ADR-0091), vindos do servidor.
  final List<DelayRisk> risks;

  int get onlineCount => drivers.where((d) => d.isOnline).length;
  int get offlineCount => drivers.where((d) => !d.isOnline).length;
  bool get isEmpty => drivers.isEmpty;

  /// Motoristas com posição, ordenados por status (em rota → parado → resto).
  List<TrackedDriver> get onMap => drivers.where((d) => d.hasPosition).toList();

  @override
  List<Object?> get props => [drivers, updatedAt, risks];
}

/// Alerta operacional derivado do estado da frota.
/// Risco previsto de estourar a janela numa parada (ADR-0091).
///
/// Diferente dos alertas operacionais, que a app deriva do próprio retrato da
/// frota, este vem calculado do servidor: depende do histórico de erro do ETA
/// daquela operação, que só o backend tem.
class DelayRisk extends Equatable {
  const DelayRisk({
    required this.deliveryId,
    required this.driverId,
    required this.severity,
    required this.probability,
    required this.slackMinutes,
  });

  final String deliveryId;
  final String? driverId;

  /// `medium` ou `high` — o servidor não envia risco baixo.
  final String severity;

  /// Probabilidade estimada de estourar a janela (0–1).
  final double probability;

  /// Minutos até o fim da janela. Negativo = já passou.
  final double slackMinutes;

  @override
  List<Object?> get props => [
        deliveryId,
        driverId,
        severity,
        probability,
        slackMinutes,
      ];
}

class FleetAlert extends Equatable {
  const FleetAlert({
    required this.id,
    required this.severity,
    required this.message,
  });

  final String id;
  final String severity; // warning | danger
  final String message;

  @override
  List<Object?> get props => [id, severity, message];
}
