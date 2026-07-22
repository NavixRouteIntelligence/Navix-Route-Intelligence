import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/intelligence_repository.dart';
import '../domain/stop_intelligence.dart';

enum StopIntelligenceStatus { idle, loading, success, error }

class StopIntelligenceState extends Equatable {
  const StopIntelligenceState({this.status = StopIntelligenceStatus.idle, this.data, this.error});

  final StopIntelligenceStatus status;
  final StopIntelligence? data;
  final Failure? error;

  @override
  List<Object?> get props => [status, data, error];
}

/// Carrega a inteligência da parada atual (previsão + acesso + coletiva) para
/// uma coordenada. Silencioso em erro para não atrapalhar a operação.
class StopIntelligenceCubit extends Cubit<StopIntelligenceState> {
  StopIntelligenceCubit(this._repository) : super(const StopIntelligenceState());

  final IntelligenceRepository _repository;

  Future<void> load({
    required double latitude,
    required double longitude,
    String id = 'stop',
    String? vehicleType,
  }) async {
    emit(const StopIntelligenceState(status: StopIntelligenceStatus.loading));
    try {
      final data = await _repository.loadForStop(
        id: id,
        latitude: latitude,
        longitude: longitude,
        vehicleType: vehicleType,
      );
      emit(StopIntelligenceState(status: StopIntelligenceStatus.success, data: data));
    } on Failure catch (f) {
      emit(StopIntelligenceState(status: StopIntelligenceStatus.error, error: f));
    } catch (_) {
      emit(const StopIntelligenceState(status: StopIntelligenceStatus.error, error: UnknownFailure()));
    }
  }
}
