import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/my_route_repository.dart';
import '../domain/my_route.dart';

enum MyRouteLoadStatus { loading, ready, error }

class MyRouteState extends Equatable {
  const MyRouteState({
    this.status = MyRouteLoadStatus.loading,
    this.route = const MyRoute.empty(),
    this.expanded = const {},
    this.reorganizing = false,
    this.error,
  });

  final MyRouteLoadStatus status;
  final MyRoute route;

  /// Tipos de grupo abertos na lista (a expansão é estado de UI, não de dados).
  final Set<String> expanded;

  /// Uma reorganização está em andamento — bloqueia ações duplicadas e mostra
  /// progresso. Não é `loading`: a rota atual segue visível por baixo.
  final bool reorganizing;

  /// A falha em si; a tradução acontece na UI (ver `failure_l10n.dart`).
  final Failure? error;

  MyRouteState copyWith({
    MyRouteLoadStatus? status,
    MyRoute? route,
    Set<String>? expanded,
    bool? reorganizing,
    Failure? error,
  }) =>
      MyRouteState(
        status: status ?? this.status,
        route: route ?? this.route,
        expanded: expanded ?? this.expanded,
        reorganizing: reorganizing ?? this.reorganizing,
        error: error,
      );

  @override
  List<Object?> get props => [status, route, expanded, reorganizing, error];
}

class MyRouteCubit extends Cubit<MyRouteState> {
  MyRouteCubit(this._repository) : super(const MyRouteState());

  final MyRouteRepository _repository;

  Future<void> load() async {
    emit(state.copyWith(status: MyRouteLoadStatus.loading));
    try {
      final route = await _repository.load();
      emit(state.copyWith(status: MyRouteLoadStatus.ready, route: route));
    } on Failure catch (f) {
      emit(state.copyWith(status: MyRouteLoadStatus.error, error: f));
    }
  }

  void toggleGroup(String type) {
    final next = Set<String>.from(state.expanded);
    if (!next.remove(type)) next.add(type);
    emit(state.copyWith(expanded: next));
  }

  /// Reorganiza a rota (IA ou manual) e recarrega. [order] é a sequência de
  /// deliveryIds — para a IA é só o conjunto atual; para manual, a ordem nova.
  /// Retorna `true` em sucesso, para a UI dar o feedback.
  Future<bool> reorganize(ReorganizeMode mode, List<String> order) async {
    if (state.reorganizing || order.length < 2) return false;
    emit(state.copyWith(reorganizing: true, error: null));
    try {
      await _repository.reorganize(mode, order: order);
      await _repository.load().then(
            (route) => emit(state.copyWith(reorganizing: false, route: route, status: MyRouteLoadStatus.ready)),
          );
      return true;
    } on Failure catch (f) {
      emit(state.copyWith(reorganizing: false, error: f));
      return false;
    }
  }
}
