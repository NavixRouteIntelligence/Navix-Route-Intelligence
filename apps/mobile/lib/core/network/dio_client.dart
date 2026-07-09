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
          // Status padrão: Dio lança DioException em não-2xx; os repositórios
          // mapeiam para Failure (incl. 401, que o AuthInterceptor intercepta).
        ),
      );
}
