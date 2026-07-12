import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/connectivity/connectivity_service.dart';
import '../data/pod_queue_store.dart';
import '../data/pod_repository.dart';

class PodSyncState extends Equatable {
  const PodSyncState({this.online = true, this.pending = 0, this.syncing = false});

  final bool online;
  final int pending;
  final bool syncing;

  PodSyncState copyWith({bool? online, int? pending, bool? syncing}) =>
      PodSyncState(online: online ?? this.online, pending: pending ?? this.pending, syncing: syncing ?? this.syncing);

  @override
  List<Object?> get props => [online, pending, syncing];
}

/// Gerencia a fila offline de comprovantes: conta pendentes, observa a conexão
/// e reenvia automaticamente quando volta a ficar online.
class PodSyncCubit extends Cubit<PodSyncState> {
  PodSyncCubit(this._repository, this._queue, this._connectivity) : super(const PodSyncState());

  final PodRepository _repository;
  final PodQueueStore _queue;
  final ConnectivityService _connectivity;
  StreamSubscription<bool>? _sub;

  Future<void> init() async {
    final online = await _connectivity.isOnline();
    emit(state.copyWith(online: online, pending: await _queue.count()));
    _sub = _connectivity.onlineChanges.listen((online) {
      emit(state.copyWith(online: online));
      if (online) syncNow();
    });
    if (online) syncNow();
  }

  /// Atualiza a contagem de pendentes (após enfileirar um novo comprovante).
  Future<void> refresh() async {
    emit(state.copyWith(pending: await _queue.count()));
    if (state.online) syncNow();
  }

  /// Tenta enviar todos os pendentes. Para na primeira falha de rede (tenta de
  /// novo mais tarde); mantém no disco o que não conseguiu enviar.
  Future<void> syncNow() async {
    if (state.syncing) return;
    final items = await _queue.all();
    if (items.isEmpty) {
      emit(state.copyWith(pending: 0));
      return;
    }
    emit(state.copyWith(syncing: true));
    for (final item in items) {
      try {
        await _repository.submit(item.submission);
        await _queue.remove(item.id);
      } catch (_) {
        break; // provável falha de rede — reenvia depois
      }
    }
    emit(state.copyWith(syncing: false, pending: await _queue.count()));
  }

  @override
  Future<void> close() {
    _sub?.cancel();
    return super.close();
  }
}
