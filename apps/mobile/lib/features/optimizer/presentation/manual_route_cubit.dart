import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/optimizer_repository.dart';
import '../domain/editable_stop.dart';
import '../domain/optimizer_models.dart';

enum ManualRouteStatus { loading, ready, submitting, success, error }

class ManualRouteState extends Equatable {
  const ManualRouteState({
    this.status = ManualRouteStatus.loading,
    this.stops = const [],
    this.result,
    this.error,
  });

  final ManualRouteStatus status;
  final List<EditableStop> stops;
  final RoutePlanResult? result;
  final String? error;

  int get lockedCount => stops.where((s) => s.locked).length;
  bool get canSubmit => stops.length >= 2;

  ManualRouteState copyWith({
    ManualRouteStatus? status,
    List<EditableStop>? stops,
    RoutePlanResult? result,
    String? error,
    bool clearError = false,
  }) {
    return ManualRouteState(
      status: status ?? this.status,
      stops: stops ?? this.stops,
      result: result ?? this.result,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, stops, result, error];
}

/// Ordem manual do Motorista (RSE-2b): carrega as paradas ativas, permite
/// arrastar para reordenar e travar posições, e envia inline via `/route-plans/mine`.
/// Dois caminhos: salvar a ordem exata (`manual`) ou reotimizar respeitando as
/// travas (estratégia padrão + `locked`) — o backend cuida das âncoras (RSE-2a).
class ManualRouteCubit extends Cubit<ManualRouteState> {
  ManualRouteCubit(this._repository) : super(const ManualRouteState());

  final OptimizerRepository _repository;

  Future<void> load() async {
    emit(const ManualRouteState(status: ManualRouteStatus.loading));
    try {
      final stops = await _repository.activeStops();
      emit(ManualRouteState(status: ManualRouteStatus.ready, stops: stops));
    } on Failure catch (f) {
      emit(ManualRouteState(status: ManualRouteStatus.error, error: f.message));
    } catch (_) {
      emit(const ManualRouteState(status: ManualRouteStatus.error, error: 'Não foi possível carregar as paradas.'));
    }
  }

  /// Move uma parada de [oldIndex] para [newIndex]. Segue a semântica do
  /// `onReorderItem` do ReorderableListView: o [newIndex] já vem **ajustado**
  /// para a remoção do item em [oldIndex] (é a posição final de destino).
  void reorder(int oldIndex, int newIndex) {
    if (state.status != ManualRouteStatus.ready) return;
    final next = List<EditableStop>.from(state.stops);
    final moved = next.removeAt(oldIndex);
    next.insert(newIndex.clamp(0, next.length), moved);
    emit(state.copyWith(stops: next));
  }

  void toggleLock(String id) {
    if (state.status != ManualRouteStatus.ready) return;
    final next = state.stops
        .map((s) => s.id == id ? s.copyWith(locked: !s.locked) : s)
        .toList();
    emit(state.copyWith(stops: next));
  }

  /// Salva exatamente a ordem atual (estratégia `manual` — não reordena nada).
  Future<void> saveManualOrder() => _submit(strategy: 'manual');

  /// Reotimiza mantendo as paradas travadas nas posições atuais (RSE-2a).
  Future<void> reoptimizeRespectingLocks() => _submit(strategy: null);

  Future<void> _submit({required String? strategy}) async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: ManualRouteStatus.submitting, clearError: true));
    try {
      final result = await _repository.optimizeStops(
        stops: state.stops,
        strategy: strategy,
        scope: OptimizerScope.mine,
      );
      emit(state.copyWith(status: ManualRouteStatus.success, result: result));
    } on Failure catch (f) {
      emit(state.copyWith(status: ManualRouteStatus.ready, error: f.message));
    } catch (_) {
      emit(state.copyWith(status: ManualRouteStatus.ready, error: 'Não foi possível salvar a rota.'));
    }
  }
}
