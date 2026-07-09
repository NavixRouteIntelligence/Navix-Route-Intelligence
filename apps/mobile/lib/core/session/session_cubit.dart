import 'package:flutter_bloc/flutter_bloc.dart';

import '../logging/app_logger.dart';
import 'session_state.dart';

/// Gerencia a sessão do usuário. Nesta fase é um esqueleto: a integração real
/// (login/refresh/secure storage) entra na vertical slice de Auth. Já expõe a
/// API que a navegação e a UI vão consumir.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit(this._logger) : super(const SessionState.unknown());

  final AppLogger _logger;

  /// Restaura a sessão persistida no início do app. Placeholder: sem token → guest.
  Future<void> bootstrap() async {
    _logger.info('SessionCubit.bootstrap');
    emit(const SessionState.unauthenticated());
  }

  /// Placeholder de login (substituído pela slice de Auth).
  void signInAs(UserRole role, {String email = 'demo@navix.app'}) {
    emit(SessionState(status: SessionStatus.authenticated, role: role, email: email));
  }

  void signOut() {
    _logger.info('SessionCubit.signOut');
    emit(const SessionState.unauthenticated());
  }
}
