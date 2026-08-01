import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/deliveries_repository.dart';
import '../domain/delivery_summary.dart';

enum DeliveriesStatus { loading, success, error }

class DeliveryStats extends Equatable {
  const DeliveryStats({
    this.all = 0,
    this.pending = 0,
    this.inRoute = 0,
    this.delivered = 0,
    this.failed = 0,
  });

  factory DeliveryStats.fromItems(
    List<DeliverySummary> items, {
    required int total,
  }) {
    var pending = 0;
    var inRoute = 0;
    var delivered = 0;
    var failed = 0;
    for (final item in items) {
      switch (item.status) {
        case DeliveryStatusView.pending:
          pending++;
          break;
        case DeliveryStatusView.inRoute:
          inRoute++;
          break;
        case DeliveryStatusView.delivered:
          delivered++;
          break;
        case DeliveryStatusView.failed:
          failed++;
          break;
        case DeliveryStatusView.unknown:
          break;
      }
    }
    return DeliveryStats(
      all: total,
      pending: pending,
      inRoute: inRoute,
      delivered: delivered,
      failed: failed,
    );
  }

  final int all;
  final int pending;
  final int inRoute;
  final int delivered;
  final int failed;

  int get remaining => pending + inRoute;

  int countFor(String? filter) => switch (filter) {
        'pending' => pending,
        'in_route' => inRoute,
        'delivered' => delivered,
        'failed' => failed,
        _ => all,
      };

  @override
  List<Object?> get props => [all, pending, inRoute, delivered, failed];
}

class DeliveriesState extends Equatable {
  const DeliveriesState({
    this.status = DeliveriesStatus.loading,
    this.items = const [],
    this.total = 0,
    this.stats = const DeliveryStats(),
    this.filter,
    this.error,
  });

  final DeliveriesStatus status;
  final List<DeliverySummary> items;
  final int total;
  final DeliveryStats stats;

  /// Filtro de status ativo (`null` = todas).
  final String? filter;
  final Failure? error;

  DeliveriesState copyWith({
    DeliveriesStatus? status,
    List<DeliverySummary>? items,
    int? total,
    DeliveryStats? stats,
    Object? filter = _sentinel,
    Failure? error,
  }) =>
      DeliveriesState(
        status: status ?? this.status,
        items: items ?? this.items,
        total: total ?? this.total,
        stats: stats ?? this.stats,
        filter: filter == _sentinel ? this.filter : filter as String?,
        error: error,
      );

  @override
  List<Object?> get props => [status, items, total, stats, filter, error];
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
      final stats = nextFilter == null
          ? DeliveryStats.fromItems(page.items, total: page.total)
          : state.stats;
      emit(
        state.copyWith(
          status: DeliveriesStatus.success,
          items: page.items,
          total: page.total,
          stats: stats,
          filter: nextFilter,
        ),
      );
    } on Failure catch (f) {
      emit(
        state.copyWith(
          status: DeliveriesStatus.error,
          error: f,
          filter: nextFilter,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          status: DeliveriesStatus.error,
          error: const UnknownFailure(),
          filter: nextFilter,
        ),
      );
    }
  }

  /// Aplica um filtro de status (ou `null` para todas) e recarrega.
  Future<void> setFilter(String? status) => load(filter: status);
}
