import 'package:equatable/equatable.dart';

/// Uma entrega da rota do motorista (subconjunto do contrato usado na tela).
class DriverDelivery extends Equatable {
  const DriverDelivery({
    required this.id,
    required this.addressLine,
    required this.cityLine,
    required this.priority,
    required this.status,
    this.windowStart,
    this.windowEnd,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String addressLine; // rua, número
  final String cityLine; // cidade — estado
  final String priority; // low | normal | high | urgent
  final String status; // pending | in_route | delivered | failed | canceled
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final double? latitude;
  final double? longitude;

  /// Tem coordenadas para consultar a inteligência da parada.
  bool get hasCoordinates => latitude != null && longitude != null;

  @override
  List<Object?> get props =>
      [id, addressLine, cityLine, priority, status, windowStart, windowEnd, latitude, longitude];
}

/// Rastreamento em tempo real do próprio motorista (/tracking/me/latest).
class DriverTracking extends Equatable {
  const DriverTracking({this.speedKmh, this.recordedAt, this.status = 'offline'});

  final double? speedKmh;
  final DateTime? recordedAt;
  final String status; // offline | en_route | finished

  bool get hasFix => recordedAt != null;

  @override
  List<Object?> get props => [speedKmh, recordedAt, status];
}

/// Dados agregados do painel do Motorista.
class DriverDashboardData extends Equatable {
  const DriverDashboardData({
    required this.total,
    required this.delivered,
    required this.next,
    required this.tracking,
    required this.podToday,
    this.first,
    this.last,
    this.score,
    this.savedKm,
    this.avgSavingsPct,
    this.remainingMinutes,
    this.remainingKm,
  });

  final int total;
  final int delivered;
  final DriverDelivery? next;
  final DriverTracking tracking;
  final int podToday;

  // Primeira e última paradas da jornada de hoje (por janela de horário).
  // Dão ao motorista a moldura do dia: quando começa e quando termina.
  final DriverDelivery? first;
  final DriverDelivery? last;

  // Derivados do último Route Plan (quando disponível). Opcionais por honestidade:
  // o backend ainda não expõe uma rota "atribuída ao motorista" dedicada.
  final int? score;
  final double? savedKm;
  final double? avgSavingsPct;
  final int? remainingMinutes;
  final double? remainingKm;

  int get remaining => (total - delivered).clamp(0, total);

  /// Posição da entrega atual na sequência (1-based), limitada ao total.
  int get currentIndex => total == 0 ? 0 : (delivered + 1).clamp(1, total);

  double get progress => total == 0 ? 0 : (delivered / total).clamp(0, 1);

  bool get isEmpty => total == 0 && podToday == 0 && next == null;

  @override
  List<Object?> get props => [
        total,
        delivered,
        next,
        tracking,
        podToday,
        first,
        last,
        score,
        savedKm,
        avgSavingsPct,
        remainingMinutes,
        remainingKm,
      ];
}
