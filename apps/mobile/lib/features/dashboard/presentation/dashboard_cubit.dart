import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/dashboard_repository.dart';
import '../domain/dashboard_data.dart';

enum DashboardStatus { loading, success, error }

class DashboardState extends Equatable {
  const DashboardState({this.status = DashboardStatus.loading, this.data, this.error});

  final DashboardStatus status;
  final DashboardData? data;
  final Failure? error;

  DashboardState copyWith({DashboardStatus? status, DashboardData? data, Failure? error}) =>
      DashboardState(status: status ?? this.status, data: data ?? this.data, error: error);

  @override
  List<Object?> get props => [status, data, error];
}

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(this._repository) : super(const DashboardState());

  final DashboardRepository _repository;

  Future<void> load() async {
    emit(const DashboardState(status: DashboardStatus.loading));
    try {
      final data = await _repository.load();
      emit(DashboardState(status: DashboardStatus.success, data: data));
    } on Failure catch (f) {
      emit(DashboardState(status: DashboardStatus.error, error: f));
    } catch (_) {
      emit(const DashboardState(status: DashboardStatus.error, error: UnknownFailure()));
    }
  }
}
