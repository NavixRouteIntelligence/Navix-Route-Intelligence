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

  Future<void> load() async {
    emit(const DriverDashboardState(status: DriverDashboardStatus.loading));
    try {
      final data = await _repository.load();
      emit(DriverDashboardState(status: DriverDashboardStatus.success, data: data));
    } on Failure catch (f) {
      emit(DriverDashboardState(status: DriverDashboardStatus.error, error: f.message));
    } catch (_) {
      emit(const DriverDashboardState(status: DriverDashboardStatus.error, error: 'Erro inesperado.'));
    }
  }
}
