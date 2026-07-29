import 'package:dio/dio.dart';

import '../domain/auth_entities.dart';

/// Chamadas cruas à API de autenticação.
/// - login/register: [authDio] (sem bearer).
/// - me/logout: [apiDio] (autenticado, com refresh transparente).
class AuthApi {
  AuthApi({required this.authDio, required this.apiDio});

  final Dio authDio;
  final Dio apiDio;

  Future<Map<String, dynamic>> login(LoginParams p) async {
    final res = await authDio.post<dynamic>(
      '/auth/mobile/login',
      data: {
        'email': p.email,
        'password': p.password,
        if (p.organization != null) 'organization': p.organization,
      },
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register(RegisterParams p) async {
    final res = await authDio.post<dynamic>(
      '/auth/mobile/register',
      data: {
        'accountType':
            p.accountType == AccountType.company ? 'company' : 'driver',
        'name': p.name,
        'email': p.email,
        'password': p.password,
        if (p.organizationName != null) 'organizationName': p.organizationName,
      },
    );
    return res.data as Map<String, dynamic>;
  }

  /// Convite de motorista (ADR-0085): rotas **públicas** — o convidado ainda
  /// não tem conta, então vão pelo [authDio], sem bearer.
  Future<Map<String, dynamic>> validateInvite(String token) async {
    final res = await authDio.get<dynamic>('/public/driver-invites/$token');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> acceptInvite(AcceptInviteParams p) async {
    final res = await authDio.post<dynamic>(
      '/public/driver-invites/${p.token}/accept',
      data: {
        'password': p.password,
        if (p.name != null) 'name': p.name,
        if (p.licenseNumber != null) 'licenseNumber': p.licenseNumber,
      },
    );
    return res.data as Map<String, dynamic>;
  }

  // Endpoint de conta compartilhado (usa o access token), não específico do mobile.
  Future<Map<String, dynamic>> me() async {
    final res = await apiDio.get<dynamic>('/auth/me');
    return res.data as Map<String, dynamic>;
  }

  Future<void> logout(String refreshToken) async {
    await apiDio.post<dynamic>(
      '/auth/mobile/logout',
      data: {'refreshToken': refreshToken},
    );
  }
}
