import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/stop_intelligence.dart';

/// Cliente da Navix Intelligence com escopo de motorista (ADR-0028–0034).
/// Combina a previsão de rota (estacionamento/acesso da parada) com a
/// inteligência coletiva do local. Lança [Failure] em erro de rede/servidor.
class IntelligenceRepository {
  IntelligenceRepository(this._dio);

  final Dio _dio;

  /// Inteligência da parada: previsão de estacionamento/acesso (route-forecast)
  /// + insight coletivo (insights) para a coordenada.
  Future<StopIntelligence> loadForStop({
    required String id,
    required double latitude,
    required double longitude,
    String? vehicleType,
  }) async {
    try {
      final forecast = await _dio.post<dynamic>('/intelligence/route-forecast', data: {
        'stops': [
          {'id': id, 'latitude': latitude, 'longitude': longitude},
        ],
        if (vehicleType != null) 'vehicleType': vehicleType,
      });
      final insight = await _dio.get<dynamic>('/intelligence/insights', queryParameters: {
        'latitude': latitude,
        'longitude': longitude,
      });

      final stop = _firstStop(forecast);
      return StopIntelligence(
        parking: _parking(stop?['parking']),
        access: _access(stop?['access']),
        insight: _insight(_data(insight)),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Registra o tempo real de atendimento (dwell) como observação coletiva.
  Future<void> recordServiceTime({
    required double latitude,
    required double longitude,
    required double minutes,
  }) =>
      _observe({
        'latitude': latitude,
        'longitude': longitude,
        'kind': 'service_time',
        'serviceMinutes': minutes,
      });

  /// Registra a dificuldade de estacionamento encontrada em campo.
  Future<void> recordParking({
    required double latitude,
    required double longitude,
    required String difficulty,
  }) =>
      _observe({
        'latitude': latitude,
        'longitude': longitude,
        'kind': 'parking',
        'parkingDifficulty': difficulty,
      });

  Future<void> _observe(Map<String, dynamic> body) async {
    try {
      await _dio.post<dynamic>('/intelligence/observations', data: body);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Map<String, dynamic> _data(Response<dynamic> res) =>
      res.data is Map<String, dynamic> && (res.data as Map)['data'] is Map<String, dynamic>
          ? (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>
          : const {};

  Map<String, dynamic>? _firstStop(Response<dynamic> res) {
    final data = _data(res);
    final schedule = data['schedule'];
    final stops = schedule is Map<String, dynamic> ? schedule['stops'] : null;
    if (stops is List && stops.isNotEmpty && stops.first is Map<String, dynamic>) {
      return stops.first as Map<String, dynamic>;
    }
    return null;
  }

  ParkingPrediction? _parking(dynamic node) {
    if (node is! Map<String, dynamic>) return null;
    final difficulty = node['difficulty'] as String?;
    if (difficulty == null) return null;
    return ParkingPrediction(
      difficulty: difficulty,
      confidence: (node['confidence'] as num?)?.toDouble() ?? 0,
      walkMinutes: (node['walkMinutes'] as num?)?.toInt() ?? 0,
    );
  }

  List<String> _access(dynamic node) {
    if (node is! List) return const [];
    return node
        .whereType<Map<String, dynamic>>()
        .map((i) => (i['text'] as String?) ?? '')
        .where((t) => t.isNotEmpty)
        .toList();
  }

  CollectiveInsight? _insight(Map<String, dynamic> data) {
    if (data.isEmpty) return null;
    final parking = data['parking'];
    final tips = data['accessTips'];
    return CollectiveInsight(
      sampleSize: (data['sampleSize'] as num?)?.toInt() ?? 0,
      parkingDifficulty:
          parking is Map<String, dynamic> ? parking['difficulty'] as String? : null,
      typicalServiceMinutes: (data['typicalServiceMinutes'] as num?)?.toDouble(),
      accessTips: tips is List ? tips.whereType<String>().toList() : const [],
    );
  }
}
