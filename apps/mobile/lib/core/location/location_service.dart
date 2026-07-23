import 'package:geolocator/geolocator.dart';

/// Amostra de localização normalizada (velocidade já em km/h).
class LocationSample {
  const LocationSample({required this.latitude, required this.longitude, this.speedKmh, this.heading});

  final double latitude;
  final double longitude;
  final double? speedKmh;
  final double? heading;
}

/// Por que a localização não está disponível. É o motivo, não o texto: cada
/// caso pede uma ação diferente do usuário e a tradução sai no ponto de
/// exibição (ver `core/error/failure_l10n.dart`).
enum LocationErrorReason {
  /// Serviço de localização desligado no dispositivo.
  serviceDisabled,

  /// Permissão negada nesta sessão — dá para pedir de novo.
  permissionDenied,

  /// Permissão negada permanentemente — só nas configurações do sistema.
  permissionBlocked,
}

/// Localização indisponível. Vira [LocationFailure] na camada de apresentação.
class LocationException implements Exception {
  const LocationException(this.reason);
  final LocationErrorReason reason;
  @override
  String toString() => 'LocationException(${reason.name})';
}

/// Abstração fina sobre o geolocator — facilita testes e isola a plataforma.
class LocationService {
  const LocationService();

  /// Garante serviço + permissão e retorna a posição atual. Lança
  /// [LocationException] com o motivo quando indisponível.
  Future<LocationSample> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationException(LocationErrorReason.serviceDisabled);
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw const LocationException(LocationErrorReason.permissionDenied);
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(LocationErrorReason.permissionBlocked);
    }

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
    return LocationSample(
      latitude: pos.latitude,
      longitude: pos.longitude,
      speedKmh: pos.speed >= 0 ? pos.speed * 3.6 : null,
      heading: pos.heading >= 0 ? pos.heading : null,
    );
  }
}
