import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/kaizen_repository.dart';
import '../domain/kaizen_summary.dart';

enum KaizenStatus { loading, ready, empty, offline, error }

class KaizenState extends Equatable {
  const KaizenState(
      {this.status = KaizenStatus.loading, this.daily, this.error});

  final KaizenStatus status;
  final KaizenDaily? daily;
  final Failure? error;

  @override
  List<Object?> get props => [status, daily, error];
}

/// Estado da tela do resumo diário.
///
/// `offline` é separado de `error` de propósito: sem rede não há nada partido,
/// e oferecer "tentar de novo" a quem está sem ligação é pedir uma ação que não
/// pode resultar. São mensagens diferentes porque são situações diferentes.
class KaizenCubit extends Cubit<KaizenState> {
  KaizenCubit(this._repository) : super(const KaizenState());

  final KaizenRepository _repository;

  Future<void> load({String? day}) async {
    emit(const KaizenState());
    try {
      final daily = await _repository.loadDaily(day: day);
      if (daily == null) {
        emit(const KaizenState(status: KaizenStatus.empty));
        return;
      }
      emit(KaizenState(status: KaizenStatus.ready, daily: daily));
    } on Failure catch (f) {
      emit(
        KaizenState(
          status:
              f is NetworkFailure ? KaizenStatus.offline : KaizenStatus.error,
          error: f,
        ),
      );
    }
  }
}
