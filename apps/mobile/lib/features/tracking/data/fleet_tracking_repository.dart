import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/fleet_tracking.dart';

/// Agrega o rastreamento da frota (Empresa): junta as últimas posições com a
/// lista de motoristas (nome/status) e expõe o histórico de um motorista.
class FleetTrackingRepository {
  FleetTrackingRepository(this._dio);

  final Dio _dio;

  Future<FleetSnapshot> loadFleet() async {
    try {
      final positions = _list(await _dio.get<dynamic>('/tracking/positions/latest'));
      final drivers = _items(await _dio.get<dynamic>('/drivers', queryParameters: {'pageSize': 200}));

      final names = {for (final d in drivers) (d['id'] as String? ?? ''): (d['name'] as String? ?? 'Motorista')};
      final byId = {for (final p in positions) (p['driverId'] as String? ?? ''): p};

      final result = <TrackedDriver>[];
      // Motoristas cadastrados, com a posição mais recente quando houver.
      for (final d in drivers) {
        final id = d['id'] as String? ?? '';
        final p = byId[id];
        result.add(_toTracked(id, names[id] ?? 'Motorista', p));
      }
      // Posições de motoristas fora da lista paginada (garante cobertura).
      for (final p in positions) {
        final id = p['driverId'] as String? ?? '';
        if (!names.containsKey(id)) {
          result.add(_toTracked(id, 'Motorista', p));
        }
      }

      result.sort((a, b) => _rank(a.status).compareTo(_rank(b.status)));
      return FleetSnapshot(drivers: result, updatedAt: DateTime.now());
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<TrackPoint>> loadHistory(String driverId) async {
    try {
      final res = await _dio.get<dynamic>('/tracking/drivers/$driverId/history');
      final data = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};
      final points = data['points'];
      if (points is! List) return const [];
      return points.whereType<Map<String, dynamic>>().map((p) {
        final speed = (p['speed'] as num?)?.toDouble();
        return TrackPoint(
          recordedAt: DateTime.tryParse((p['recordedAt'] as String?) ?? '') ?? DateTime.now(),
          status: trackStatusFrom(p['status'] as String?, speedKmh: speed),
          speedKmh: speed,
        );
      }).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  TrackedDriver _toTracked(String id, String name, Map<String, dynamic>? p) {
    if (p == null) {
      return TrackedDriver(id: id, name: name, status: TrackStatus.offline);
    }
    final speed = (p['speed'] as num?)?.toDouble();
    return TrackedDriver(
      id: id,
      name: name,
      status: trackStatusFrom(p['status'] as String?, speedKmh: speed),
      latitude: (p['latitude'] as num?)?.toDouble(),
      longitude: (p['longitude'] as num?)?.toDouble(),
      speedKmh: speed,
      recordedAt: DateTime.tryParse((p['recordedAt'] as String?) ?? ''),
    );
  }

  int _rank(TrackStatus s) => switch (s) {
        TrackStatus.enRoute => 0,
        TrackStatus.stopped => 1,
        TrackStatus.finished => 2,
        TrackStatus.offline => 3,
      };

  List<Map<String, dynamic>> _list(Response<dynamic> res) {
    final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
    return data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];
  }

  List<Map<String, dynamic>> _items(Response<dynamic> res) {
    final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
    return data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];
  }
}
