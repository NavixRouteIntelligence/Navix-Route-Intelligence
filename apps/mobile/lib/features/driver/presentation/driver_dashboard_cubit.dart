import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/error/failure.dart';
import '../data/driver_dashboard_repository.dart';
import '../domain/driver_dashboard_data.dart';

enum DriverDashboardStatus { loading, success, error }

class DriverDashboardState extends Equatable {
  const DriverDashboardState({
    this.status = DriverDashboardStatus.loading,
    this.data,
    this.error,
    this.live = true,
    this.online = true,
    this.lastUpdatedAt,
  });

  final DriverDashboardStatus status;
  final DriverDashboardData? data;
  final String? error;

  /// Recebendo atualizações em tempo real (M2). Quando falso, o auto refresh
  /// está pausado (economia de bateria/dados) e o painel fica estático.
  final bool live;

  /// Conectividade (M5). Quando offline, o painel mostra o banner e serve o
  /// último dado bom em cache; o polling pausa até a conexão voltar.
  final bool online;

  /// Instante da última sincronização bem-sucedida — alimenta o "atualizado há Xs".
  final DateTime? lastUpdatedAt;

  DriverDashboardState copyWith({
    DriverDashboardStatus? status,
    DriverDashboardData? data,
    String? error,
    bool? live,
    bool? online,
    DateTime? lastUpdatedAt,
    bool clearError = false,
  }) {
    return DriverDashboardState(
      status: status ?? this.status,
      data: data ?? this.data,
      error: clearError ? null : (error ?? this.error),
      live: live ?? this.live,
      online: online ?? this.online,
      lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
    );
  }

  @override
  List<Object?> get props => [status, data, error, live, online, lastUpdatedAt];
}

class DriverDashboardCubit extends Cubit<DriverDashboardState> {
  DriverDashboardCubit(
    this._repository, {
    ConnectivityService? connectivity,
    DateTime Function()? clock,
  })  : _connectivity = connectivity,
        _now = clock ?? DateTime.now,
        super(const DriverDashboardState()) {
    _watchConnectivity();
  }

  final DriverDashboardRepository _repository;
  final ConnectivityService? _connectivity;
  final DateTime Function() _now;

  /// Intervalo do auto refresh (M1/M2). Curto o bastante para o painel parecer
  /// vivo, longo o bastante para não pesar em bateria/dados.
  static const autoRefreshInterval = Duration(seconds: 30);

  Timer? _timer;
  StreamSubscription<bool>? _connSub;

  /// Carrega o painel. Em [silent] (auto refresh / pull sobre dados existentes)
  /// não emite `loading` — evita o flash do skeleton — e uma falha **preserva**
  /// os últimos dados bons em vez de jogar a tela para o estado de erro.
  Future<void> load({bool silent = false}) async {
    if (!silent) {
      emit(state.copyWith(status: DriverDashboardStatus.loading, clearError: true));
    }
    try {
      final data = await _repository.load();
      emit(state.copyWith(
        status: DriverDashboardStatus.success,
        data: data,
        lastUpdatedAt: _now(),
        clearError: true,
      ));
    } on Failure catch (f) {
      if (silent && state.data != null) return; // mantém o que já está na tela
      emit(state.copyWith(status: DriverDashboardStatus.error, error: f.message));
    } catch (_) {
      if (silent && state.data != null) return;
      emit(state.copyWith(status: DriverDashboardStatus.error, error: 'Erro inesperado.'));
    }
  }

  /// Liga o auto refresh periódico (idempotente) enquanto `live` e `online`.
  /// Cada tick faz um [load] silencioso. O timer é cancelado em [close].
  void startAutoRefresh() {
    if (state.live && state.online) _ensureTimer();
  }

  void _ensureTimer() {
    _timer ??= Timer.periodic(autoRefreshInterval, (_) => load(silent: true));
  }

  void stopAutoRefresh() {
    _timer?.cancel();
    _timer = null;
  }

  /// Pausa/retoma o tempo real (M2). Ao retomar, sincroniza na hora.
  void toggleLive() {
    if (state.live) {
      stopAutoRefresh();
      emit(state.copyWith(live: false));
    } else {
      emit(state.copyWith(live: true));
      if (state.online) {
        _ensureTimer();
        load(silent: true);
      }
    }
  }

  /// Observa a conectividade (M5): pausa o polling ao ficar offline e, ao voltar,
  /// retoma e sincroniza. Sem serviço injetado (ex.: testes), é no-op.
  void _watchConnectivity() {
    final c = _connectivity;
    if (c == null) return;
    c.isOnline().then((online) {
      if (!online && !isClosed) emit(state.copyWith(online: false));
    }).catchError((_) {});
    _connSub = c.onlineChanges.listen(_onConnectivityChanged);
  }

  void _onConnectivityChanged(bool online) {
    if (online == state.online) return;
    emit(state.copyWith(online: online));
    if (online) {
      if (state.live) _ensureTimer();
      load(silent: true); // sincroniza ao reconectar
    } else {
      stopAutoRefresh(); // não martela a rede offline
    }
  }

  @override
  Future<void> close() {
    stopAutoRefresh();
    _connSub?.cancel();
    return super.close();
  }
}
