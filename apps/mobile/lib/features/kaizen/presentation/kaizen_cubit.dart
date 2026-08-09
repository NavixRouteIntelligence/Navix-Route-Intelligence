import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/kaizen_cache.dart';
import '../data/kaizen_repository.dart';
import '../domain/kaizen_summary.dart';

enum KaizenStatus { loading, ready, empty, offline, error }

class KaizenState extends Equatable {
  const KaizenState({
    this.status = KaizenStatus.loading,
    this.daily,
    this.error,
    this.fromCache = false,
  });

  final KaizenStatus status;
  final KaizenDaily? daily;
  final Failure? error;

  /// `true` quando o que está no ecrã veio do disco, não da rede. A tela diz
  /// isso: um resumo que na verdade é de anteontem, sem aviso, é pior do que
  /// nenhum.
  final bool fromCache;

  @override
  List<Object?> get props => [status, daily, error, fromCache];
}

/// Estado da tela do resumo diário.
///
/// `offline` é separado de `error` de propósito: sem rede não há nada partido,
/// e oferecer "tentar de novo" a quem está sem ligação é pedir uma ação que não
/// pode resultar. São mensagens diferentes porque são situações diferentes.
class KaizenCubit extends Cubit<KaizenState> {
  KaizenCubit(this._repository, [KaizenCache? cache])
      : _cache = cache ?? KaizenCache(),
        super(const KaizenState());

  final KaizenRepository _repository;
  final KaizenCache _cache;

  Future<void> load({String? day}) async {
    emit(const KaizenState());
    try {
      final daily = await _repository.loadDaily(day: day);
      if (daily == null) {
        emit(const KaizenState(status: KaizenStatus.empty));
        return;
      }
      // Só o resumo pedido «por omissão» é guardado: um dia específico que
      // alguém consultou não é o que se quer ver ao abrir a app sem rede.
      if (day == null) await _cache.save(daily.raw);
      emit(KaizenState(status: KaizenStatus.ready, daily: daily));
    } on Failure catch (f) {
      // Sem rede, o resumo guardado ainda serve — desde que a tela diga que é
      // guardado. Com erro de servidor não se serve cache: o pedido chegou, e é
      // a resposta que está partida.
      if (f is NetworkFailure) {
        final guardado = await _cache.read();
        if (guardado != null) {
          emit(
            KaizenState(
              status: KaizenStatus.ready,
              daily: KaizenDaily.fromJson(guardado),
              fromCache: true,
            ),
          );
          return;
        }
      }
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
