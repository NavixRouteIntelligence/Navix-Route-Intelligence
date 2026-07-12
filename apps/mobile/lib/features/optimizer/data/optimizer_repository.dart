import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/optimizer_models.dart';

/// Acesso ao Route Optimizer (/route-plans) e às entregas a otimizar.
class OptimizerRepository {
  OptimizerRepository(this._dio);

  final Dio _dio;

  /// Entregas pendentes (candidatas à otimização).
  Future<List<SelectableDelivery>> pendingDeliveries() async {
    try {
      final res = await _dio.get<dynamic>('/deliveries', queryParameters: {'status': 'pending', 'pageSize': 100});
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      if (data is! List) return const [];
      return data.whereType<Map<String, dynamic>>().map(_toSelectable).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Otimiza a rota com as entregas escolhidas.
  Future<RoutePlanResult> optimize({
    required List<String> deliveryIds,
    double? averageSpeedKmh,
    double? serviceTimeMinutes,
  }) async {
    try {
      final res = await _dio.post<dynamic>('/route-plans', data: {
        'deliveryIds': deliveryIds,
        if (averageSpeedKmh != null) 'averageSpeedKmh': averageSpeedKmh,
        if (serviceTimeMinutes != null) 'serviceTimeMinutes': serviceTimeMinutes,
      });
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      return RoutePlanResult.fromJson(data is Map<String, dynamic> ? data : const {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  SelectableDelivery _toSelectable(Map<String, dynamic> d) {
    final addr = d['address'] is Map<String, dynamic> ? d['address'] as Map<String, dynamic> : const {};
    final street = (addr['street'] as String?) ?? '';
    final number = (addr['number'] as String?) ?? '';
    final city = (addr['city'] as String?) ?? '';
    final state = (addr['state'] as String?) ?? '';
    final lat = (addr['latitude'] as num?)?.toDouble();
    final lng = (addr['longitude'] as num?)?.toDouble();
    return SelectableDelivery(
      id: (d['id'] as String?) ?? '',
      addressLine: [street, number].where((s) => s.isNotEmpty).join(', '),
      cityLine: [city, state].where((s) => s.isNotEmpty).join(' — '),
      priority: (d['priority'] as String?) ?? 'normal',
      geocoded: lat != null && lng != null && !(lat == 0 && lng == 0),
    );
  }
}
