import 'package:geolocator/geolocator.dart';

/// Amostra de localização normalizada (velocidade já em km/h).
class LocationSample {
  const LocationSample({required this.latitude, required this.longitude, this.speedKmh, this.heading});

  final double latitude;
  final double longitude;
  final double? speedKmh;
  final double? heading;
}

/// Erro de localização apresentável ao usuário.
class LocationException implements Exception {
  const LocationException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Abstração fina sobre o geolocator — facilita testes e isola a plataforma.
class LocationService {
  const LocationService();

  /// Garante serviço + permissão e retorna a posição atual. Lança
  /// [LocationException] com mensagem amigável quando indisponível.
  Future<LocationSample> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationException('Ative a localização do dispositivo para compartilhar.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw const LocationException('Permissão de localização negada.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException('Permissão de localização bloqueada nas configurações.');
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
