import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';

/// Dados para registrar um comprovante de entrega (POD).
class PodSubmission {
  const PodSubmission({
    required this.deliveryId,
    required this.status, // delivered | absent | refused
    this.note,
    this.latitude,
    this.longitude,
    this.photoDataUrl,
    this.signatureDataUrl,
    this.label,
  });

  final String deliveryId;
  final String status;
  final String? note;
  final double? latitude;
  final double? longitude;
  final String? photoDataUrl;
  final String? signatureDataUrl;

  /// Rótulo amigável para a fila (ex.: endereço/cliente). Não vai para a API.
  final String? label;

  /// Corpo enviado à API (/pod).
  Map<String, dynamic> toJson() => {
        'deliveryId': deliveryId,
        'status': status,
        if (note != null && note!.isNotEmpty) 'note': note,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (photoDataUrl != null) 'photo': photoDataUrl,
        if (signatureDataUrl != null) 'signature': signatureDataUrl,
      };

  /// Serialização completa para persistência offline (inclui o rótulo).
  Map<String, dynamic> toStorage() => {...toJson(), if (label != null) 'label': label};

  factory PodSubmission.fromStorage(Map<String, dynamic> j) => PodSubmission(
        deliveryId: (j['deliveryId'] as String?) ?? '',
        status: (j['status'] as String?) ?? 'delivered',
        note: j['note'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        photoDataUrl: j['photo'] as String?,
        signatureDataUrl: j['signature'] as String?,
        label: j['label'] as String?,
      );
}

/// Envio do comprovante de entrega (/pod). Lança [Failure] em erro.
class PodRepository {
  PodRepository(this._dio);

  final Dio _dio;

  Future<void> submit(PodSubmission pod) async {
    try {
      await _dio.post<dynamic>('/pod', data: pod.toJson());
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
