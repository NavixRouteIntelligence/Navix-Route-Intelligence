import 'dart:async';

import 'package:dio/dio.dart';

import '../storage/secure_session_store.dart';

/// Injeta o access token e, em `401`, tenta **um** refresh (single-flight) e
/// repete a requisição. Falha no refresh → limpa a sessão e propaga o erro.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this.store, required this.authDio});

  final SecureSessionStore store;

  /// Dio SEM interceptor, usado para o refresh e o retry (evita recursão).
  final Dio authDio;

  Completer<String?>? _refreshing;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await store.readAccessToken();
    if (token != null && !options.headers.containsKey('Authorization')) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final is401 = err.response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra['__retried'] == true;

    if (!is401 || alreadyRetried) {
      handler.next(err);
      return;
    }

    final newToken = await _refresh();
    if (newToken == null) {
      await store.clear();
      handler.next(err);
      return;
    }

    try {
      final req = err.requestOptions;
      req.extra['__retried'] = true;
      req.headers['Authorization'] = 'Bearer $newToken';
      final response = await authDio.fetch<dynamic>(req);
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Renova o token uma única vez por vez; chamadas concorrentes aguardam a mesma.
  Future<String?> _refresh() {
    if (_refreshing != null) return _refreshing!.future;
    final completer = Completer<String?>();
    _refreshing = completer;

    () async {
      try {
        final refreshToken = await store.readRefreshToken();
        if (refreshToken == null) {
          completer.complete(null);
          return;
        }
        final res = await authDio.post<dynamic>(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
        );
        final data = res.data as Map<String, dynamic>;
        final access = data['accessToken'] as String;
        final newRefresh = data['refreshToken'] as String;
        await store.updateTokens(accessToken: access, refreshToken: newRefresh);
        completer.complete(access);
      } catch (_) {
        completer.complete(null);
      } finally {
        _refreshing = null;
      }
    }();

    return completer.future;
  }
}
