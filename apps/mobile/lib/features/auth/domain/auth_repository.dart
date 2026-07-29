import 'auth_entities.dart';

/// Contrato do repositório de autenticação (implementado na camada de dados).
/// Lança [Failure] em erro (rede/credenciais/servidor).
abstract interface class AuthRepository {
  Future<AuthSession> login(LoginParams params);

  Future<AuthSession> register(RegisterParams params);

  /// Resolve um convite pelo token. Lança [InviteNotFoundFailure] se o link
  /// não valer mais.
  Future<DriverInvitePreview> validateInvite(String token);

  /// Cria a conta dentro da organização que convidou e **já autentica** — o
  /// motorista acabou de escolher a senha, pedir que a digite de novo seria
  /// atrito à toa.
  Future<AuthSession> acceptInvite(AcceptInviteParams params);

  /// Restaura a sessão persistida e valida no servidor (com refresh se preciso).
  /// Retorna `null` quando não há sessão válida.
  Future<AuthUser?> restore();

  Future<void> logout();
}
