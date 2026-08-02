import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/driver_performance.dart';

/// Desempenho do **próprio** motorista (ADR-0097).
///
/// Só existe `GET /me/performance`. Não há variante para consultar outro
/// motorista, e a ausência é o desenho: sem endpoint não há ranking.
class DriverPerformanceRepository {
  DriverPerformanceRepository(this._dio);

  final Dio _dio;

  Future<DriverPerformance> load({int windowDays = 30}) async {
    try {
      final res = await _dio.get<dynamic>(
        '/me/performance',
        queryParameters: {'windowDays': windowDays},
      );
      final body = res.data;
      final data = body is Map<String, dynamic> ? body['data'] : null;
      if (data is! Map<String, dynamic>) return const DriverPerformance.empty();
      return DriverPerformance.fromJson(data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
