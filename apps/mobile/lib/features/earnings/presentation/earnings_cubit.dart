import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/tariff_store.dart';
import '../domain/driver_tariff.dart';

/// Estado da tarifa do motorista. `loaded` evita piscar o card antes de ler o
/// armazém local.
class EarningsState {
  const EarningsState({this.tariff = const DriverTariff(), this.loaded = false});

  final DriverTariff tariff;
  final bool loaded;

  EarningsState copyWith({DriverTariff? tariff, bool? loaded}) =>
      EarningsState(tariff: tariff ?? this.tariff, loaded: loaded ?? this.loaded);
}

/// Gerencia a tarifa configurável (M3, opção A): carrega do armazém local e
/// salva as edições. A estimativa em si é derivada no card, cruzando a tarifa
/// com as entregas/distância do painel.
class EarningsCubit extends Cubit<EarningsState> {
  EarningsCubit(this._store) : super(const EarningsState());

  final TariffStore _store;

  Future<void> load() async {
    final tariff = await _store.read();
    emit(EarningsState(tariff: tariff, loaded: true));
  }

  Future<void> save({required double perDelivery, required double perKm}) async {
    final tariff = DriverTariff(
      perDelivery: perDelivery < 0 ? 0 : perDelivery,
      perKm: perKm < 0 ? 0 : perKm,
    );
    await _store.save(tariff);
    emit(state.copyWith(tariff: tariff, loaded: true));
  }
}
