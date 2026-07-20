import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/maintenance_models.dart';

/// Acesso à gestão do veículo (FASE 3): veículo, registros e lembretes de
/// manutenção. Lança [Failure] tipado em erro de rede/servidor.
class MaintenanceRepository {
  MaintenanceRepository(this._dio);

  final Dio _dio;

  /// Veículo do motorista autônomo (o primeiro da lista do tenant). `null` se
  /// nenhum cadastrado.
  Future<MaintenanceVehicle?> myVehicle() async {
    try {
      final res = await _dio.get<dynamic>('/fleet/vehicles', queryParameters: {'pageSize': 1});
      final list = _list(res);
      return list.isEmpty ? null : MaintenanceVehicle.fromJson(list.first);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<MaintenanceRecord>> records(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>('/fleet/vehicles/$vehicleId/maintenance');
      return _list(res).map(MaintenanceRecord.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<MaintenanceReminder>> reminders(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>('/fleet/vehicles/$vehicleId/maintenance/reminders');
      return _data(res).map(MaintenanceReminder.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> addRecord(String vehicleId, NewMaintenanceRecord record) async {
    try {
      await _dio.post<dynamic>('/fleet/vehicles/$vehicleId/maintenance', data: record.toJson());
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> deleteRecord(String vehicleId, String id) async {
    try {
      await _dio.delete<dynamic>('/fleet/vehicles/$vehicleId/maintenance/$id');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> updateOdometer(String vehicleId, int odometerKm) async {
    try {
      await _dio.patch<dynamic>('/fleet/vehicles/$vehicleId', data: {'odometerKm': odometerKm});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// `data` de uma coleção paginada (`{ data: [...] }`).
  List<Map<String, dynamic>> _list(Response<dynamic> res) {
    final body = res.data;
    final data = body is Map<String, dynamic> ? body['data'] : null;
    return data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];
  }

  /// `data` de um recurso cujo payload é uma lista (`{ data: [...] }`).
  List<Map<String, dynamic>> _data(Response<dynamic> res) => _list(res);
}
