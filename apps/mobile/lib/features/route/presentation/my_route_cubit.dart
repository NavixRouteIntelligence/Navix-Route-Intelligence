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
    this.error,
  });

  final MyRouteLoadStatus status;
  final MyRoute route;

  /// Tipos de grupo abertos na lista (a expansão é estado de UI, não de dados).
  final Set<String> expanded;

  final String? error;

  MyRouteState copyWith({
    MyRouteLoadStatus? status,
    MyRoute? route,
    Set<String>? expanded,
    String? error,
  }) =>
      MyRouteState(
        status: status ?? this.status,
        route: route ?? this.route,
        expanded: expanded ?? this.expanded,
        error: error,
      );

  @override
  List<Object?> get props => [status, route, expanded, error];
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
      emit(state.copyWith(status: MyRouteLoadStatus.error, error: f.message));
    }
  }

  void toggleGroup(String type) {
    final next = Set<String>.from(state.expanded);
    if (!next.remove(type)) next.add(type);
    emit(state.copyWith(expanded: next));
  }
}
