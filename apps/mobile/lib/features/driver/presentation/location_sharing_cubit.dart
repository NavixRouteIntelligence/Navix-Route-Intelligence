import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../../../core/location/location_service.dart';
import '../data/tracking_repository.dart';

class LocationSharingState extends Equatable {
  const LocationSharingState({this.sharing = false, this.busy = false, this.error, this.lastSentAt});

  final bool sharing;
  final bool busy;
  final String? error;
  final DateTime? lastSentAt;

  LocationSharingState copyWith({bool? sharing, bool? busy, String? error, DateTime? lastSentAt, bool clearError = false}) {
    return LocationSharingState(
      sharing: sharing ?? this.sharing,
      busy: busy ?? this.busy,
      error: clearError ? null : (error ?? this.error),
      lastSentAt: lastSentAt ?? this.lastSentAt,
    );
  }

  @override
  List<Object?> get props => [sharing, busy, error, lastSentAt];
}

/// Controla o compartilhamento de posição em tempo real: obtém a localização e
/// envia periodicamente ao backend enquanto ativo.
class LocationSharingCubit extends Cubit<LocationSharingState> {
  LocationSharingCubit(this._location, this._tracking, {Duration interval = const Duration(seconds: 10)})
      : _interval = interval,
        super(const LocationSharingState());

  final LocationService _location;
  final TrackingRepository _tracking;
  final Duration _interval;
  Timer? _timer;

  Future<void> start() async {
    if (state.sharing || state.busy) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      await _sendOnce();
      emit(state.copyWith(sharing: true, busy: false, lastSentAt: DateTime.now()));
      _timer = Timer.periodic(_interval, (_) => _tick());
    } on LocationException catch (e) {
      emit(state.copyWith(busy: false, error: e.message));
    } on Failure catch (f) {
      emit(state.copyWith(busy: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Não foi possível iniciar o compartilhamento.'));
    }
  }

  Future<void> _tick() async {
    try {
      await _sendOnce();
      emit(state.copyWith(lastSentAt: DateTime.now(), clearError: true));
    } catch (_) {
      // Falha pontual não derruba o compartilhamento; a próxima tentativa segue.
    }
  }

  Future<void> _sendOnce() async {
    final sample = await _location.current();
    await _tracking.sendPosition(sample);
  }

  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    emit(state.copyWith(sharing: false, busy: false));
  }

  Future<void> toggle() => state.sharing ? stop() : start();

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}
