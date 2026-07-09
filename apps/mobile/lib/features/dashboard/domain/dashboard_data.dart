import 'package:equatable/equatable.dart';

class DeliveryCounts extends Equatable {
  const DeliveryCounts({
    this.pending = 0,
    this.inRoute = 0,
    this.delivered = 0,
    this.failed = 0,
    this.total = 0,
  });

  final int pending;
  final int inRoute;
  final int delivered;
  final int failed;
  final int total;

  @override
  List<Object?> get props => [pending, inRoute, delivered, failed, total];
}

class PodCounts extends Equatable {
  const PodCounts({this.delivered = 0, this.absent = 0, this.refused = 0, this.total = 0});

  final int delivered;
  final int absent;
  final int refused;
  final int total;

  @override
  List<Object?> get props => [delivered, absent, refused, total];
}

class FleetDriver extends Equatable {
  const FleetDriver({required this.id, required this.status});
  final String id;
  final String status; // offline | en_route | finished

  @override
  List<Object?> get props => [id, status];
}

/// Dados agregados do painel da Empresa.
class DashboardData extends Equatable {
  const DashboardData({
    required this.deliveries,
    required this.routesTotal,
    required this.avgScore,
    required this.savedKm,
    required this.perfSeries,
    required this.pod,
    required this.fleet,
  });

  final DeliveryCounts deliveries;
  final int routesTotal;
  final int avgScore;
  final double savedKm;
  final List<double> perfSeries;
  final PodCounts pod;
  final List<FleetDriver> fleet;

  bool get isEmpty => deliveries.total == 0 && routesTotal == 0 && pod.total == 0;

  @override
  List<Object?> get props => [deliveries, routesTotal, avgScore, savedKm, perfSeries, pod, fleet];
}
