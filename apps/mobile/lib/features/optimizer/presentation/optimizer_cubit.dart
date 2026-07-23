import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/optimizer_repository.dart';
import '../domain/optimizer_models.dart';

enum OptimizerStep { deliveries, config, result }

class OptimizerState extends Equatable {
  const OptimizerState({
    this.step = OptimizerStep.deliveries,
    this.loadingDeliveries = false,
    this.deliveries = const [],
    this.selected = const {},
    this.averageSpeedKmh = 30,
    this.serviceTimeMinutes = 5,
    this.optimizing = false,
    this.result,
    this.error,
  });

  final OptimizerStep step;
  final bool loadingDeliveries;
  final List<SelectableDelivery> deliveries;
  final Set<String> selected;
  final double averageSpeedKmh;
  final double serviceTimeMinutes;
  final bool optimizing;
  final RoutePlanResult? result;
  final Failure? error;

  int get selectableCount => deliveries.where((d) => d.geocoded).length;
  int get ignoredCount => deliveries.where((d) => !d.geocoded).length;
  bool get canOptimize => selected.isNotEmpty;

  OptimizerState copyWith({
    OptimizerStep? step,
    bool? loadingDeliveries,
    List<SelectableDelivery>? deliveries,
    Set<String>? selected,
    double? averageSpeedKmh,
    double? serviceTimeMinutes,
    bool? optimizing,
    RoutePlanResult? result,
    Failure? error,
    bool clearError = false,
  }) {
    return OptimizerState(
      step: step ?? this.step,
      loadingDeliveries: loadingDeliveries ?? this.loadingDeliveries,
      deliveries: deliveries ?? this.deliveries,
      selected: selected ?? this.selected,
      averageSpeedKmh: averageSpeedKmh ?? this.averageSpeedKmh,
      serviceTimeMinutes: serviceTimeMinutes ?? this.serviceTimeMinutes,
      optimizing: optimizing ?? this.optimizing,
      result: result ?? this.result,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [step, loadingDeliveries, deliveries, selected, averageSpeedKmh, serviceTimeMinutes, optimizing, result, error];
}

class OptimizerCubit extends Cubit<OptimizerState> {
  OptimizerCubit(this._repository) : super(const OptimizerState());

  final OptimizerRepository _repository;

  Future<void> loadDeliveries() async {
    emit(state.copyWith(loadingDeliveries: true, clearError: true));
    try {
      final items = await _repository.pendingDeliveries();
      // Pré-seleciona todas as geocodificadas.
      final preselected = items.where((d) => d.geocoded).map((d) => d.id).toSet();
      emit(state.copyWith(loadingDeliveries: false, deliveries: items, selected: preselected));
    } on Failure catch (f) {
      emit(state.copyWith(loadingDeliveries: false, error: f));
    } catch (_) {
      emit(state.copyWith(loadingDeliveries: false, error: const UnknownFailure()));
    }
  }

  void toggle(String id) {
    final next = Set<String>.from(state.selected);
    next.contains(id) ? next.remove(id) : next.add(id);
    emit(state.copyWith(selected: next));
  }

  void goToConfig() => emit(state.copyWith(step: OptimizerStep.config, clearError: true));
  void backToDeliveries() => emit(state.copyWith(step: OptimizerStep.deliveries));
  void setSpeed(double v) => emit(state.copyWith(averageSpeedKmh: v));
  void setServiceTime(double v) => emit(state.copyWith(serviceTimeMinutes: v));

  /// Escopo do endpoint por papel (empresa × motorista). Setado na criação pela
  /// tela; `optimize()` aceita override para teste. Mesmo fluxo, mesma tela — só
  /// muda o path no repositório (ADR-0060).
  OptimizerScope scope = OptimizerScope.company;

  Future<void> optimize({OptimizerScope? scope}) async {
    if (state.selected.isEmpty) return;
    emit(state.copyWith(optimizing: true, clearError: true));
    try {
      final result = await _repository.optimize(
        deliveryIds: state.selected.toList(),
        averageSpeedKmh: state.averageSpeedKmh,
        serviceTimeMinutes: state.serviceTimeMinutes,
        scope: scope ?? this.scope,
      );
      emit(state.copyWith(optimizing: false, step: OptimizerStep.result, result: result));
    } on Failure catch (f) {
      emit(state.copyWith(optimizing: false, error: f));
    } catch (_) {
      emit(state.copyWith(optimizing: false, error: const UnknownFailure()));
    }
  }

  /// Volta ao início mantendo as entregas carregadas.
  void reset() => emit(OptimizerState(deliveries: state.deliveries, selected: state.selected, loadingDeliveries: false));

  /// Endereço de uma entrega (para exibir na sequência do resultado).
  String addressOf(String deliveryId) {
    for (final d in state.deliveries) {
      if (d.id == deliveryId) return d.addressLine.isEmpty ? d.cityLine : d.addressLine;
    }
    return 'Parada';
  }
}
