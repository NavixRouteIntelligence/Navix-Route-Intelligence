import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/driver_tariff.dart';

/// Persistência local da tarifa do motorista (M3, opção A). Fica no dispositivo
/// — é preferência do motorista, não dado de negócio no servidor. Reusa o
/// armazém seguro já disponível no app.
class TariffStore {
  TariffStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _kPerDelivery = 'navix.tariff.perDelivery';
  static const _kPerKm = 'navix.tariff.perKm';

  Future<DriverTariff> read() async {
    final perDelivery = double.tryParse(await _storage.read(key: _kPerDelivery) ?? '') ?? 0;
    final perKm = double.tryParse(await _storage.read(key: _kPerKm) ?? '') ?? 0;
    return DriverTariff(perDelivery: perDelivery, perKm: perKm);
  }

  Future<void> save(DriverTariff tariff) async {
    await _storage.write(key: _kPerDelivery, value: tariff.perDelivery.toString());
    await _storage.write(key: _kPerKm, value: tariff.perKm.toString());
  }
}
