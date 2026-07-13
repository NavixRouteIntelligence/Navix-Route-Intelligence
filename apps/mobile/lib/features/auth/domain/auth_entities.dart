import 'package:equatable/equatable.dart';

import '../../../core/session/session_state.dart';

/// Tipo de conta escolhido no cadastro.
enum AccountType { driver, company }

/// Usuário autenticado (representação de domínio).
class AuthUser extends Equatable {
  const AuthUser({
    required this.id,
    required this.tenantId,
    required this.email,
    required this.roles,
  });

  final String id;
  final String tenantId;
  final String email;
  final List<String> roles;

  /// Mapeia os papéis (RBAC) para o perfil da UI.
  UserRole get role => roles.contains('driver') && !_hasAdmin ? UserRole.driver : UserRole.company;

  bool get _hasAdmin =>
      roles.contains('admin') || roles.contains('dispatcher') || roles.contains('fleet_manager');

  @override
  List<Object?> get props => [id, tenantId, email, roles];
}

/// Sessão = usuário + tokens.
class AuthSession extends Equatable {
  const AuthSession({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  final AuthUser user;
  final String accessToken;
  final String refreshToken;

  @override
  List<Object?> get props => [user, accessToken, refreshToken];
}

/// Credenciais de login. O tenant é resolvido pelo e-mail (ou por [organization],
/// o slug da empresa, opcional) — sem tenantId (ADR-0016).
class LoginParams extends Equatable {
  const LoginParams({required this.email, required this.password, this.organization});

  final String email;
  final String password;

  /// Identificador (slug) da empresa — opcional, para desambiguação.
  final String? organization;

  @override
  List<Object?> get props => [email, password, organization];
}

/// Dados de cadastro por perfil.
class RegisterParams extends Equatable {
  const RegisterParams({
    required this.accountType,
    required this.name,
    required this.email,
    required this.password,
    this.organizationName,
  });

  final AccountType accountType;
  final String name;
  final String email;
  final String password;
  final String? organizationName;

  @override
  List<Object?> get props => [accountType, name, email, password, organizationName];
}
