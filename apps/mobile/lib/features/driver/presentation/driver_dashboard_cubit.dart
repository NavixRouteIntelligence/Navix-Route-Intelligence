import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/driver_dashboard_repository.dart';
import '../domain/driver_dashboard_data.dart';

enum DriverDashboardStatus { loading, success, error }

class DriverDashboardState extends Equatable {
  const DriverDashboardState({this.status = DriverDashboardStatus.loading, this.data, this.error});

  final DriverDashboardStatus status;
  final DriverDashboardData? data;
  final String? error;

  @override
  List<Object?> get props => [status, data, error];
}

class DriverDashboardCubit extends Cubit<DriverDashboardState> {
  DriverDashboardCubit(this._repository) : super(const DriverDashboardState());

  final DriverDashboardRepository _repository;

  /// Intervalo do auto refresh (M1). Curto o bastante para o painel parecer
  /// vivo, longo o bastante para não pesar em bateria/dados.
  static const autoRefreshInterval = Duration(seconds: 30);

  Timer? _timer;

  /// Carrega o painel. Em [silent] (auto refresh / pull sobre dados existentes)
  /// não emite `loading` — evita o flash do skeleton — e uma falha **preserva**
  /// os últimos dados bons em vez de jogar a tela para o estado de erro.
  Future<void> load({bool silent = false}) async {
    if (!silent) {
      emit(const DriverDashboardState(status: DriverDashboardStatus.loading));
    }
    try {
      final data = await _repository.load();
      emit(DriverDashboardState(status: DriverDashboardStatus.success, data: data));
    } on Failure catch (f) {
      if (silent && state.data != null) return; // mantém o que já está na tela
      emit(DriverDashboardState(status: DriverDashboardStatus.error, error: f.message));
    } catch (_) {
      if (silent && state.data != null) return;
      emit(const DriverDashboardState(status: DriverDashboardStatus.error, error: 'Erro inesperado.'));
    }
  }

  /// Liga o auto refresh periódico (idempotente). Cada tick faz um [load]
  /// silencioso. O timer é cancelado em [close].
  void startAutoRefresh() {
    _timer ??= Timer.periodic(autoRefreshInterval, (_) => load(silent: true));
  }

  void stopAutoRefresh() {
    _timer?.cancel();
    _timer = null;
  }

  @override
  Future<void> close() {
    stopAutoRefresh();
    return super.close();
  }
}
