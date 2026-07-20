import 'package:equatable/equatable.dart';

/// Tarifa configurada pelo motorista (M3, opção A). Estimativa **no app** — não
/// há modelo de remuneração no backend. Valores em euros; 0 = não configurado.
class DriverTariff extends Equatable {
  const DriverTariff({this.perDelivery = 0, this.perKm = 0});

  /// Valor por entrega concluída (€).
  final double perDelivery;

  /// Valor por quilômetro rodado (€).
  final double perKm;

  bool get isConfigured => perDelivery > 0 || perKm > 0;

  @override
  List<Object?> get props => [perDelivery, perKm];
}

/// Estimativa de ganhos da rota: tarifa por entrega × nº de entregas + tarifa
/// por km × distância. Determinística; um modelo de earnings no backend
/// (opção B) substituiria isto sem tocar a UI.
double estimateEarnings(DriverTariff tariff, {required int deliveries, required double km}) {
  final byDelivery = tariff.perDelivery * deliveries;
  final byDistance = tariff.perKm * (km <= 0 ? 0 : km);
  final total = byDelivery + byDistance;
  return (total * 100).roundToDouble() / 100; // 2 casas
}
