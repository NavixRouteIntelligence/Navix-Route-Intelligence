import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/driver_performance_repository.dart';
import '../domain/driver_performance.dart';

enum DriverPerformanceStatus { loading, ready, error }

class DriverPerformanceState extends Equatable {
  const DriverPerformanceState({
    this.status = DriverPerformanceStatus.loading,
    this.performance = const DriverPerformance.empty(),
    this.error,
  });

  final DriverPerformanceStatus status;
  final DriverPerformance performance;

  /// A falha em si; a tradução acontece na UI (ver `failure_l10n.dart`).
  final Failure? error;

  @override
  List<Object?> get props => [status, performance, error];
}

class DriverPerformanceCubit extends Cubit<DriverPerformanceState> {
  DriverPerformanceCubit(this._repository) : super(const DriverPerformanceState());

  final DriverPerformanceRepository _repository;

  Future<void> load() async {
    emit(const DriverPerformanceState(status: DriverPerformanceStatus.loading));
    try {
      final performance = await _repository.load();
      emit(
        DriverPerformanceState(
          status: DriverPerformanceStatus.ready,
          performance: performance,
        ),
      );
    } on Failure catch (e) {
      emit(DriverPerformanceState(status: DriverPerformanceStatus.error, error: e));
    }
  }
}
