import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/deliveries_repository.dart';
import '../domain/delivery_summary.dart';

enum DeliveriesStatus { loading, success, error }

class DeliveriesState extends Equatable {
  const DeliveriesState({
    this.status = DeliveriesStatus.loading,
    this.items = const [],
    this.total = 0,
    this.filter,
    this.error,
  });

  final DeliveriesStatus status;
  final List<DeliverySummary> items;
  final int total;
  /// Filtro de status ativo (`null` = todas).
  final String? filter;
  final String? error;

  DeliveriesState copyWith({
    DeliveriesStatus? status,
    List<DeliverySummary>? items,
    int? total,
    Object? filter = _sentinel,
    String? error,
  }) =>
      DeliveriesState(
        status: status ?? this.status,
        items: items ?? this.items,
        total: total ?? this.total,
        filter: filter == _sentinel ? this.filter : filter as String?,
        error: error,
      );

  @override
  List<Object?> get props => [status, items, total, filter, error];
}

const _sentinel = Object();

class DeliveriesCubit extends Cubit<DeliveriesState> {
  DeliveriesCubit(this._repository) : super(const DeliveriesState());

  final DeliveriesRepository _repository;

  Future<void> load({Object? filter = _sentinel}) async {
    final nextFilter = filter == _sentinel ? state.filter : filter as String?;
    emit(state.copyWith(status: DeliveriesStatus.loading, filter: nextFilter));
    try {
      final page = await _repository.list(status: nextFilter);
      emit(state.copyWith(
        status: DeliveriesStatus.success,
        items: page.items,
        total: page.total,
        filter: nextFilter,
      ));
    } on Failure catch (f) {
      emit(state.copyWith(status: DeliveriesStatus.error, error: f.message, filter: nextFilter));
    } catch (_) {
      emit(state.copyWith(status: DeliveriesStatus.error, error: 'Erro inesperado.', filter: nextFilter));
    }
  }

  /// Aplica um filtro de status (ou `null` para todas) e recarrega.
  Future<void> setFilter(String? status) => load(filter: status);
}
