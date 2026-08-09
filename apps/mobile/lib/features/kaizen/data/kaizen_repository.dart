import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/kaizen_summary.dart';

/// Resumo diário do **próprio** motorista (ADR-0120).
///
/// Só existe `GET /me/kaizen/daily`. Não há variante com `driverId`, e a
/// ausência é o desenho: sem endpoint não há como pedir o resumo de outra
/// pessoa, nem por engano nem por pressão futura.
class KaizenRepository {
  KaizenRepository(this._dio);

  final Dio _dio;

  /// `day` ausente significa **ontem**, resolvido pelo servidor no fuso de quem
  /// opera — a app não calcula o dia, para não haver duas verdades sobre ele.
  Future<KaizenDaily?> loadDaily({String? day}) async {
    try {
      final res = await _dio.get<dynamic>(
        '/me/kaizen/daily',
        queryParameters: day == null ? null : {'day': day},
      );
      final body = res.data;
      final data = body is Map<String, dynamic> ? body['data'] : null;
      if (data is! Map<String, dynamic>) return null;
      return KaizenDaily.fromJson(data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
