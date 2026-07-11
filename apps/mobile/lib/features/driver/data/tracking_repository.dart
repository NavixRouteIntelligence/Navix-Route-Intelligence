import 'package:dio/dio.dart';

import '../../../core/location/location_service.dart';
import '../../../core/network/dio_failure_mapper.dart';

/// Envio da posição do próprio motorista (/tracking/positions). Lança [Failure].
class TrackingRepository {
  TrackingRepository(this._dio);

  final Dio _dio;

  Future<void> sendPosition(LocationSample sample, {String status = 'en_route'}) async {
    try {
      await _dio.post<dynamic>('/tracking/positions', data: {
        'latitude': sample.latitude,
        'longitude': sample.longitude,
        if (sample.speedKmh != null) 'speed': sample.speedKmh,
        if (sample.heading != null) 'heading': sample.heading,
        'status': status,
      });
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
