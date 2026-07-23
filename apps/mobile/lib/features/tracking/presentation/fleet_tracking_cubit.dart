import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/fleet_tracking_repository.dart';
import '../domain/fleet_tracking.dart';

enum FleetStatus { loading, success, error }

class FleetTrackingState extends Equatable {
  const FleetTrackingState({
    this.status = FleetStatus.loading,
    this.snapshot,
    this.error,
    this.selectedId,
    this.history = const [],
    this.historyLoading = false,
    this.live = true,
  });

  final FleetStatus status;
  final FleetSnapshot? snapshot;
  final Failure? error;
  final String? selectedId;
  final List<TrackPoint> history;
  final bool historyLoading;
  final bool live; // recebendo atualizações (polling ligado)

  TrackedDriver? get selected {
    final s = snapshot;
    if (s == null || selectedId == null) return null;
    for (final d in s.drivers) {
      if (d.id == selectedId) return d;
    }
    return null;
  }

  List<FleetAlert> get alerts {
    final s = snapshot;
    if (s == null) return const [];
    final out = <FleetAlert>[];
    for (final d in s.drivers) {
      if (d.status == TrackStatus.stopped) {
        out.add(FleetAlert(id: 'stop-${d.id}', severity: 'warning', message: '${d.name} está parado.'));
      } else if (d.gpsStale) {
        out.add(FleetAlert(id: 'gps-${d.id}', severity: 'danger', message: 'GPS de ${d.name} instável.'));
      }
    }
    return out;
  }

  FleetTrackingState copyWith({
    FleetStatus? status,
    FleetSnapshot? snapshot,
    Failure? error,
    String? selectedId,
    List<TrackPoint>? history,
    bool? historyLoading,
    bool? live,
    bool clearError = false,
    bool clearSelection = false,
  }) {
    return FleetTrackingState(
      status: status ?? this.status,
      snapshot: snapshot ?? this.snapshot,
      error: clearError ? null : (error ?? this.error),
      selectedId: clearSelection ? null : (selectedId ?? this.selectedId),
      history: history ?? this.history,
      historyLoading: historyLoading ?? this.historyLoading,
      live: live ?? this.live,
    );
  }

  @override
  List<Object?> get props => [status, snapshot, error, selectedId, history, historyLoading, live];
}

class FleetTrackingCubit extends Cubit<FleetTrackingState> {
  FleetTrackingCubit(this._repository, {Duration interval = const Duration(seconds: 8)})
      : _interval = interval,
        super(const FleetTrackingState());

  final FleetTrackingRepository _repository;
  final Duration _interval;
  Timer? _timer;

  Future<void> load() async {
    emit(state.copyWith(status: FleetStatus.loading, clearError: true));
    try {
      final snap = await _repository.loadFleet();
      emit(state.copyWith(status: FleetStatus.success, snapshot: snap));
      if (state.live) _startTimer();
    } on Failure catch (f) {
      emit(state.copyWith(status: FleetStatus.error, error: f));
    } catch (_) {
      emit(state.copyWith(status: FleetStatus.error, error: const UnknownFailure()));
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) => _refresh());
  }

  Future<void> _refresh() async {
    try {
      final snap = await _repository.loadFleet();
      emit(state.copyWith(snapshot: snap));
    } catch (_) {/* atualização silenciosa não derruba a tela */}
  }

  Future<void> select(String driverId) async {
    emit(state.copyWith(selectedId: driverId, historyLoading: true, history: const []));
    try {
      final points = await _repository.loadHistory(driverId);
      emit(state.copyWith(history: points, historyLoading: false));
    } catch (_) {
      emit(state.copyWith(historyLoading: false));
    }
  }

  void clearSelection() => emit(state.copyWith(clearSelection: true, history: const []));

  /// Liga/desliga o recebimento de atualizações (polling).
  void toggleLive() {
    if (state.live) {
      _timer?.cancel();
      emit(state.copyWith(live: false));
    } else {
      emit(state.copyWith(live: true));
      _startTimer();
      _refresh();
    }
  }

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}
