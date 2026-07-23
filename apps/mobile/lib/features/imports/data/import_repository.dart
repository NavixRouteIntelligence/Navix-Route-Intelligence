import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/import_models.dart';

/// Acesso ao módulo Import Center (/imports). Lança [Failure] em erro.
class ImportRepository {
  ImportRepository(this._dio);

  final Dio _dio;

  /// Envia o arquivo para pré-visualização (multipart). Não persiste entregas.
  Future<ImportPreview> preview({required String path, required String filename}) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(path, filename: filename),
      });
      final res = await _dio.post<dynamic>('/imports/preview', data: form);
      return ImportPreview.fromJson(_map(res));
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Confirma o lote, criando as entregas. A rota é preparada automaticamente
  /// pela IA no backend (ADR-0074) — não há opt-in nem botão "Otimizar".
  Future<ImportConfirmation> confirm(String batchId) async {
    try {
      final res = await _dio.post<dynamic>('/imports/$batchId/confirm', data: const <String, dynamic>{});
      return ImportConfirmation.fromJson(_map(res));
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Histórico de lotes.
  Future<List<ImportBatch>> list({int pageSize = 10}) async {
    try {
      final res = await _dio.get<dynamic>('/imports', queryParameters: {'pageSize': pageSize});
      final data = _map(res)['data'];
      return data is List
          ? data.whereType<Map<String, dynamic>>().map(ImportBatch.fromJson).toList()
          : const [];
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Map<String, dynamic> _map(Response<dynamic> res) =>
      res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};
}
