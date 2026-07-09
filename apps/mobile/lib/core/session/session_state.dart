import 'package:equatable/equatable.dart';

/// Perfil do usuário (RBAC), derivado dos papéis do backend.
enum UserRole { driver, company }

enum SessionStatus { unknown, authenticated, unauthenticated }

/// Estado de sessão consumido pela navegação (guards) e pela UI.
class SessionState extends Equatable {
  const SessionState({required this.status, this.role, this.email});

  const SessionState.unknown() : status = SessionStatus.unknown, role = null, email = null;
  const SessionState.unauthenticated()
      : status = SessionStatus.unauthenticated,
        role = null,
        email = null;

  final SessionStatus status;
  final UserRole? role;
  final String? email;

  bool get isAuthenticated => status == SessionStatus.authenticated;
  bool get isDriver => role == UserRole.driver;

  @override
  List<Object?> get props => [status, role, email];
}
