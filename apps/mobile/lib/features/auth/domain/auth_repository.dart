import 'auth_entities.dart';

/// Contrato do repositório de autenticação (implementado na camada de dados).
/// Lança [Failure] em erro (rede/credenciais/servidor).
abstract interface class AuthRepository {
  Future<AuthSession> login(LoginParams params);

  Future<AuthSession> register(RegisterParams params);

  /// Restaura a sessão persistida e valida no servidor (com refresh se preciso).
  /// Retorna `null` quando não há sessão válida.
  Future<AuthUser?> restore();

  Future<void> logout();
}
