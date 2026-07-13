import 'package:equatable/equatable.dart';

/// Entrega selecionável para otimização (subconjunto do contrato).
class SelectableDelivery extends Equatable {
  const SelectableDelivery({
    required this.id,
    required this.addressLine,
    required this.cityLine,
    required this.priority,
    required this.geocoded,
  });

  final String id;
  final String addressLine;
  final String cityLine;
  final String priority; // low | normal | high | urgent
  final bool geocoded; // sem geocodificação → não pode otimizar

  @override
  List<Object?> get props => [id, addressLine, cityLine, priority, geocoded];
}

class RouteMetrics extends Equatable {
  const RouteMetrics({this.totalDistanceKm = 0, this.totalTimeMinutes = 0, this.stops = 0});

  final double totalDistanceKm;
  final double totalTimeMinutes;
  final int stops;

  factory RouteMetrics.fromJson(Map<String, dynamic> j) => RouteMetrics(
        totalDistanceKm: (j['totalDistanceKm'] as num?)?.toDouble() ?? 0,
        totalTimeMinutes: (j['totalTimeMinutes'] as num?)?.toDouble() ?? 0,
        stops: (j['stops'] as num?)?.toInt() ?? 0,
      );

  @override
  List<Object?> get props => [totalDistanceKm, totalTimeMinutes, stops];
}

class RouteSavings extends Equatable {
  const RouteSavings({this.distanceKm = 0, this.timeMinutes = 0, this.distancePct = 0, this.timePct = 0});

  final double distanceKm;
  final double timeMinutes;
  final double distancePct;
  final double timePct;

  factory RouteSavings.fromJson(Map<String, dynamic> j) => RouteSavings(
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        timeMinutes: (j['timeMinutes'] as num?)?.toDouble() ?? 0,
        distancePct: (j['distancePct'] as num?)?.toDouble() ?? 0,
        timePct: (j['timePct'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [distanceKm, timeMinutes, distancePct, timePct];
}

class RouteStop extends Equatable {
  const RouteStop({required this.sequence, required this.deliveryId, this.etaMinutes = 0, this.cumulativeDistanceKm = 0});

  final int sequence;
  final String deliveryId;
  final double etaMinutes;
  final double cumulativeDistanceKm;

  factory RouteStop.fromJson(Map<String, dynamic> j) => RouteStop(
        sequence: (j['sequence'] as num?)?.toInt() ?? 0,
        deliveryId: (j['deliveryId'] as String?) ?? '',
        etaMinutes: (j['etaMinutes'] as num?)?.toDouble() ?? 0,
        cumulativeDistanceKm: (j['cumulativeDistanceKm'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [sequence, deliveryId, etaMinutes, cumulativeDistanceKm];
}

/// Resultado da otimização (RoutePlan).
class RoutePlanResult extends Equatable {
  const RoutePlanResult({
    required this.id,
    required this.metrics,
    required this.baseline,
    required this.savings,
    required this.score,
    required this.stops,
  });

  final String id;
  final RouteMetrics metrics;
  final RouteMetrics baseline;
  final RouteSavings savings;
  final int score;
  final List<RouteStop> stops;

  factory RoutePlanResult.fromJson(Map<String, dynamic> j) => RoutePlanResult(
        id: (j['id'] as String?) ?? '',
        metrics: j['metrics'] is Map<String, dynamic> ? RouteMetrics.fromJson(j['metrics'] as Map<String, dynamic>) : const RouteMetrics(),
        baseline: j['baseline'] is Map<String, dynamic> ? RouteMetrics.fromJson(j['baseline'] as Map<String, dynamic>) : const RouteMetrics(),
        savings: j['savings'] is Map<String, dynamic> ? RouteSavings.fromJson(j['savings'] as Map<String, dynamic>) : const RouteSavings(),
        score: (j['score'] as num?)?.toInt() ?? 0,
        stops: (j['stops'] as List?)?.whereType<Map<String, dynamic>>().map(RouteStop.fromJson).toList() ?? const [],
      );

  @override
  List<Object?> get props => [id, metrics, baseline, savings, score, stops];
}
