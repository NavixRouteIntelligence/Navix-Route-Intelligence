import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/dashboard_data.dart';

/// Agrega os endpoints existentes (entregas, rotas, POD, frota) num único
/// [DashboardData]. Lança [Failure] em erro de rede/servidor.
class DashboardRepository {
  DashboardRepository(this._dio);

  final Dio _dio;

  Future<DashboardData> load() async {
    try {
      final deliveries = await _dio.get<dynamic>('/deliveries', queryParameters: {'pageSize': 100});
      final plans = await _dio.get<dynamic>('/route-plans', queryParameters: {'pageSize': 50});
      final podRes = await _dio.get<dynamic>('/pod/summary');
      final fleetRes = await _dio.get<dynamic>('/tracking/positions/latest');

      return DashboardData(
        deliveries: _deliveries(deliveries.data as Map<String, dynamic>),
        routesTotal: _metaTotal(plans.data as Map<String, dynamic>),
        avgScore: _avgScore(plans.data as Map<String, dynamic>),
        savedKm: _savedKm(plans.data as Map<String, dynamic>),
        perfSeries: _perfSeries(plans.data as Map<String, dynamic>),
        pod: _pod(podRes.data as Map<String, dynamic>),
        fleet: _fleet(fleetRes.data as Map<String, dynamic>),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

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

  int _avgScore(Map<String, dynamic> json) {
    final items = _items(json);
    if (items.isEmpty) return 0;
    final sum = items.fold<int>(0, (a, p) => a + ((p['score'] as num?)?.toInt() ?? 0));
    return (sum / items.length).round();
  }

  double _savedKm(Map<String, dynamic> json) {
    return _items(json).fold<double>(0, (a, p) {
      final savings = p['savings'];
      final km = savings is Map<String, dynamic> ? (savings['distanceKm'] as num?)?.toDouble() ?? 0 : 0;
      return a + km;
    });
  }

  List<double> _perfSeries(Map<String, dynamic> json) {
    final items = _items(json).take(7).toList().reversed.toList();
    return items.map<double>((p) {
      final metrics = p['metrics'];
      return metrics is Map<String, dynamic> ? (metrics['totalDistanceKm'] as num?)?.toDouble() ?? 0 : 0;
    }).toList();
  }

  PodCounts _pod(Map<String, dynamic> json) => PodCounts(
        delivered: (json['delivered'] as num?)?.toInt() ?? 0,
        absent: (json['absent'] as num?)?.toInt() ?? 0,
        refused: (json['refused'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
      );

  List<FleetDriver> _fleet(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is! List) return const [];
    return data.whereType<Map<String, dynamic>>().map((p) {
      return FleetDriver(
        id: (p['driverId'] as String?) ?? '',
        status: (p['status'] as String?) ?? 'offline',
      );
    }).toList();
  }
}
