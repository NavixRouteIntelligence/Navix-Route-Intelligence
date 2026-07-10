import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/dashboard_data.dart';

/// Agrega os endpoints existentes (entregas, rotas, POD, frota, importações) num
/// único [DashboardData]. Lança [Failure] em erro de rede/servidor.
class DashboardRepository {
  DashboardRepository(this._dio);

  final Dio _dio;

  Future<DashboardData> load() async {
    try {
      final deliveries = _map(await _dio.get<dynamic>('/deliveries', queryParameters: {'pageSize': 100}));
      final plans = _map(await _dio.get<dynamic>('/route-plans', queryParameters: {'pageSize': 50}));
      final pod = _map(await _dio.get<dynamic>('/pod/summary'));
      final positions = _map(await _dio.get<dynamic>('/tracking/positions/latest'));
      final imports = _map(await _dio.get<dynamic>('/imports', queryParameters: {'pageSize': 5}));
      final vehicles = _map(await _dio.get<dynamic>('/vehicles', queryParameters: {'pageSize': 100}));
      final drivers = _map(await _dio.get<dynamic>('/drivers', queryParameters: {'pageSize': 100}));

      final planItems = _items(plans);
      return DashboardData(
        deliveries: _deliveries(deliveries),
        routesTotal: _metaTotal(plans),
        avgScore: _avgScore(planItems),
        savedKm: _savedKm(planItems),
        avgSavingsPct: _avgSavingsPct(planItems),
        perfPlanned: _series(planItems, baseline: true),
        perfOptimized: _series(planItems, baseline: false),
        pod: _pod(pod),
        positions: _positions(positions),
        fleet: _fleet(vehicles, drivers),
        recentPlans: _recentPlans(planItems),
        recentImports: _recentImports(imports),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Map<String, dynamic> _map(Response<dynamic> res) =>
      res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};

  int _metaTotal(Map<String, dynamic> json) {
    final meta = json['meta'];
    return meta is Map<String, dynamic> ? (meta['total'] as num?)?.toInt() ?? 0 : 0;
  }

  List<Map<String, dynamic>> _items(Map<String, dynamic> json) {
    final data = json['data'];
    return data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];
  }

  DeliveryCounts _deliveries(Map<String, dynamic> json) {
    var pending = 0, inRoute = 0, delivered = 0, failed = 0;
    for (final d in _items(json)) {
      switch (d['status']) {
        case 'pending':
          pending++;
        case 'in_route':
          inRoute++;
        case 'delivered':
          delivered++;
        case 'failed':
          failed++;
      }
    }
    return DeliveryCounts(
      pending: pending,
      inRoute: inRoute,
      delivered: delivered,
      failed: failed,
      total: _metaTotal(json),
    );
  }

  int _avgScore(List<Map<String, dynamic>> items) {
    if (items.isEmpty) return 0;
    final sum = items.fold<int>(0, (a, p) => a + ((p['score'] as num?)?.toInt() ?? 0));
    return (sum / items.length).round();
  }

  double _savedKm(List<Map<String, dynamic>> items) => items.fold<double>(0, (a, p) {
        final s = p['savings'];
        return a + (s is Map<String, dynamic> ? (s['distanceKm'] as num?)?.toDouble() ?? 0 : 0);
      });

  double _avgSavingsPct(List<Map<String, dynamic>> items) {
    if (items.isEmpty) return 0;
    final sum = items.fold<double>(0, (a, p) {
      final s = p['savings'];
      return a + (s is Map<String, dynamic> ? (s['distancePct'] as num?)?.toDouble() ?? 0 : 0);
    });
    return sum / items.length;
  }

  List<double> _series(List<Map<String, dynamic>> items, {required bool baseline}) {
    final take = items.take(7).toList().reversed.toList();
    return take.map<double>((p) {
      final m = p[baseline ? 'baseline' : 'metrics'];
      return m is Map<String, dynamic> ? (m['totalDistanceKm'] as num?)?.toDouble() ?? 0 : 0;
    }).toList();
  }

  PodCounts _pod(Map<String, dynamic> json) => PodCounts(
        delivered: (json['delivered'] as num?)?.toInt() ?? 0,
        absent: (json['absent'] as num?)?.toInt() ?? 0,
        refused: (json['refused'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
      );

  List<FleetDriver> _positions(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is! List) return const [];
    return data.whereType<Map<String, dynamic>>().map((p) {
      return FleetDriver(id: (p['driverId'] as String?) ?? '', status: (p['status'] as String?) ?? 'offline');
    }).toList();
  }

  FleetCounts _fleet(Map<String, dynamic> vehicles, Map<String, dynamic> drivers) {
    final v = _items(vehicles);
    final d = _items(drivers);
    return FleetCounts(
      totalVehicles: _metaTotal(vehicles),
      activeVehicles: v.where((x) => x['status'] == 'active').length,
      totalDrivers: _metaTotal(drivers),
      activeDrivers: d.where((x) => x['status'] == 'active').length,
    );
  }

  List<PlanSummary> _recentPlans(List<Map<String, dynamic>> items) {
    return items.take(3).map((p) {
      final s = p['savings'];
      final m = p['metrics'];
      return PlanSummary(
        id: (p['id'] as String?) ?? '',
        score: (p['score'] as num?)?.toInt() ?? 0,
        savingsPct: s is Map<String, dynamic> ? (s['distancePct'] as num?)?.toDouble() ?? 0 : 0,
        stops: m is Map<String, dynamic> ? (m['stops'] as num?)?.toInt() ?? 0 : 0,
      );
    }).toList();
  }

  List<ImportSummaryItem> _recentImports(Map<String, dynamic> json) {
    return _items(json).take(3).map((b) {
      final summary = b['summary'];
      final valid = summary is Map<String, dynamic> ? (summary['valid'] as num?)?.toInt() ?? 0 : 0;
      final total = summary is Map<String, dynamic> ? (summary['total'] as num?)?.toInt() ?? 0 : 0;
      return ImportSummaryItem(
        filename: (b['filename'] as String?) ?? '—',
        valid: valid,
        total: total,
        status: (b['status'] as String?) ?? 'preview',
      );
    }).toList();
  }
}
