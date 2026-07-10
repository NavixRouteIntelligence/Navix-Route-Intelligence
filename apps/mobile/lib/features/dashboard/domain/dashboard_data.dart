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

class FleetCounts extends Equatable {
  const FleetCounts({
    this.activeVehicles = 0,
    this.totalVehicles = 0,
    this.activeDrivers = 0,
    this.totalDrivers = 0,
  });

  final int activeVehicles;
  final int totalVehicles;
  final int activeDrivers;
  final int totalDrivers;

  @override
  List<Object?> get props => [activeVehicles, totalVehicles, activeDrivers, totalDrivers];
}

class PlanSummary extends Equatable {
  const PlanSummary({required this.id, required this.score, required this.savingsPct, required this.stops});
  final String id;
  final int score;
  final double savingsPct;
  final int stops;

  @override
  List<Object?> get props => [id, score, savingsPct, stops];
}

class ImportSummaryItem extends Equatable {
  const ImportSummaryItem({required this.filename, required this.valid, required this.total, required this.status});
  final String filename;
  final int valid;
  final int total;
  final String status;

  @override
  List<Object?> get props => [filename, valid, total, status];
}

/// Dados agregados do painel da Empresa.
class DashboardData extends Equatable {
  const DashboardData({
    required this.deliveries,
    required this.routesTotal,
    required this.avgScore,
    required this.savedKm,
    required this.avgSavingsPct,
    required this.perfPlanned,
    required this.perfOptimized,
    required this.pod,
    required this.positions,
    required this.fleet,
    required this.recentPlans,
    required this.recentImports,
  });

  final DeliveryCounts deliveries;
  final int routesTotal;
  final int avgScore;
  final double savedKm;
  final double avgSavingsPct;
  final List<double> perfPlanned;
  final List<double> perfOptimized;
  final PodCounts pod;
  final List<FleetDriver> positions;
  final FleetCounts fleet;
  final List<PlanSummary> recentPlans;
  final List<ImportSummaryItem> recentImports;

  int get concluded => deliveries.delivered;
  double get completionRate =>
      deliveries.total == 0 ? 0 : (deliveries.delivered / deliveries.total) * 100;

  bool get isEmpty =>
      deliveries.total == 0 && routesTotal == 0 && pod.total == 0 && recentImports.isEmpty;

  @override
  List<Object?> get props => [
        deliveries,
        routesTotal,
        avgScore,
        savedKm,
        avgSavingsPct,
        perfPlanned,
        perfOptimized,
        pod,
        positions,
        fleet,
        recentPlans,
        recentImports,
      ];
}
