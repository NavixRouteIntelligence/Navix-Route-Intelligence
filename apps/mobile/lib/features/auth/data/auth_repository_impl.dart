import 'package:dio/dio.dart';

import '../../../core/error/failure.dart';
import '../../../core/network/dio_failure_mapper.dart';
import '../../../core/storage/secure_session_store.dart';
import '../domain/auth_entities.dart';
import '../domain/auth_repository.dart';
import 'auth_api.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({required this.api, required this.store});

  final AuthApi api;
  final SecureSessionStore store;

  @override
  Future<AuthSession> login(LoginParams params) async {
    try {
      final session = _sessionFromJson(await api.login(params));
      await _persist(session);
      return session;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<AuthSession> register(RegisterParams params) async {
    try {
      final session = _sessionFromJson(await api.register(params));
      await _persist(session);
      return session;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<AuthUser?> restore() async {
    if (!await store.hasSession()) return null;
    try {
      final json = await api.me();
      final user = _userFromJson(json['data'] as Map<String, dynamic>);
      return user;
    } on DioException {
      // Refresh já foi tentado pelo interceptor; falhou → sessão inválida.
      await store.clear();
      return null;
    }
  }

  @override
  Future<void> logout() async {
    final refresh = await store.readRefreshToken();
    if (refresh != null) {
      try {
        await api.logout(refresh);
      } on DioException {
        // Logout é best-effort; limpamos localmente de qualquer forma.
      }
    }
    await store.clear();
  }

  Future<void> _persist(AuthSession session) async {
    await store.saveSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: StoredUser(
        id: session.user.id,
        tenantId: session.user.tenantId,
        email: session.user.email,
        roles: session.user.roles,
      ),
    );
  }

  AuthSession _sessionFromJson(Map<String, dynamic> json) {
    final tokens = json['tokens'] as Map<String, dynamic>?;
    if (tokens == null) throw const ServerFailure('Resposta de autenticação inválida.');
    return AuthSession(
      user: _userFromJson(json['user'] as Map<String, dynamic>),
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }

  AuthUser _userFromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        email: json['email'] as String,
        roles: (json['roles'] as List<dynamic>).map((e) => e as String).toList(),
      );
}
