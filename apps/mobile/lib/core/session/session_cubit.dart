import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/auth/domain/auth_entities.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../logging/app_logger.dart';
import '../security/biometric_service.dart';
import '../storage/secure_session_store.dart';
import 'session_state.dart';

/// Controlador de sessão e ponto único de verdade do RBAC no app.
/// Orquestra login/registro/restauração/logout, o desbloqueio biométrico e a
/// derivação do perfil (motorista × empresa) a partir dos papéis do backend.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit({
    required AuthRepository repository,
    required SecureSessionStore store,
    required BiometricService biometric,
    required AppLogger logger,
  })  : _repository = repository,
        _store = store,
        _biometric = biometric,
        _logger = logger,
        super(const SessionState.unknown());

  final AuthRepository _repository;
  final SecureSessionStore _store;
  final BiometricService _biometric;
  final AppLogger _logger;

  /// Restaura a sessão persistida no início do app ("manter conectado"),
  /// exigindo biometria se o usuário a habilitou.
  Future<void> bootstrap() async {
    if (!await _store.hasSession() || !await _store.isKeepConnected()) {
      emit(const SessionState.unauthenticated());
      return;
    }
    if (await _store.isBiometricEnabled()) {
      final ok = await _biometric.authenticate(reason: 'Desbloquear o Navix');
      if (!ok) {
        emit(const SessionState.unauthenticated());
        return;
      }
    }
    try {
      final user = await _repository.restore();
      emit(user == null ? const SessionState.unauthenticated() : _authenticated(user));
    } catch (e) {
      _logger.warning('Falha ao restaurar sessão', e);
      emit(const SessionState.unauthenticated());
    }
  }

  /// Login. Propaga [Failure] para a UI tratar; em sucesso, autentica.
  Future<void> login(
    LoginParams params, {
    bool keepConnected = true,
    bool enableBiometric = false,
  }) async {
    final session = await _repository.login(params);
    await _store.setKeepConnected(keepConnected);
    await _store.setBiometricEnabled(enableBiometric && keepConnected);
    emit(_authenticated(session.user));
  }

  /// Cadastro por perfil (Empresa × Motorista). Autentica em sucesso.
  Future<void> register(RegisterParams params) async {
    final session = await _repository.register(params);
    await _store.setKeepConnected(true);
    emit(_authenticated(session.user));
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const SessionState.unauthenticated());
  }

  Future<bool> isBiometricAvailable() => _biometric.isAvailable();

  Future<void> setBiometricEnabled(bool enabled) => _store.setBiometricEnabled(enabled);

  SessionState _authenticated(AuthUser user) => SessionState(
        status: SessionStatus.authenticated,
        role: user.role,
        email: user.email,
      );
}
