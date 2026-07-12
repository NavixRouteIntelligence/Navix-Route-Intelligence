import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/secure_session_store.dart';
import 'auth_interceptor.dart';

/// Fábrica dos clientes HTTP.
/// - [authDio]: sem interceptor (login/registro/refresh e retries).
/// - [apiDio]: autenticado, com refresh transparente em 401.
class DioClient {
  DioClient({required AppConfig config, required SecureSessionStore store})
      : authDio = _base(config),
        apiDio = _base(config) {
    apiDio.interceptors.add(AuthInterceptor(store: store, authDio: authDio));
  }

  final Dio authDio;
  final Dio apiDio;

  static Dio _base(AppConfig config) => Dio(
        BaseOptions(
          baseUrl: config.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          contentType: 'application/json',
          // Modo *bearer*: o backend (padrão de produção) usa cookie HttpOnly para
          // o refresh token no cliente web. Clientes nativos não têm cookie jar
          // compartilhado, então pedem o token no corpo via este header e o
          // guardam no armazenamento seguro (secure_session_store).
          headers: {'X-Auth-Mode': 'bearer'},
          // Status padrão: Dio lança DioException em não-2xx; os repositórios
          // mapeiam para Failure (incl. 401, que o AuthInterceptor intercepta).
        ),
      );
}
