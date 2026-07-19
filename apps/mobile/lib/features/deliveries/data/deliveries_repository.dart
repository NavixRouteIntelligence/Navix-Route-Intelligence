import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/delivery_summary.dart';

/// Resultado paginado de entregas.
class DeliveriesPage {
  const DeliveriesPage({required this.items, required this.total});

  final List<DeliverySummary> items;
  final int total;
}

/// Acessa o endpoint de entregas da Empresa (`GET /deliveries`). A RLS garante
/// o escopo do tenant; aqui só listamos. Lança [Failure] em erro de rede.
class DeliveriesRepository {
  DeliveriesRepository(this._dio);

  final Dio _dio;

  Future<DeliveriesPage> list({String? status, int pageSize = 100}) async {
    try {
      final res = await _dio.get<dynamic>(
        '/deliveries',
        queryParameters: {
          'pageSize': pageSize,
          if (status != null) 'status': status,
        },
      );
      final json = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};
      final data = json['data'];
      final items = data is List
          ? data.whereType<Map<String, dynamic>>().map(DeliverySummary.fromJson).toList()
          : <DeliverySummary>[];
      final meta = json['meta'];
      final total = meta is Map<String, dynamic> ? (meta['total'] as num?)?.toInt() ?? items.length : items.length;
      return DeliveriesPage(items: items, total: total);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
