import 'package:dio/dio.dart';

import '../error/failure.dart';

/// Converte uma [DioException] na [Failure] de domínio correspondente.
///
/// [unauthorized] permite ao chamador trocar o significado do 401: em endpoints
/// autenticados ele é "sessão expirada" (padrão), mas no login/registro é
/// "credencial inválida" — não havia sessão para expirar.
Failure mapDioException(DioException e, {Failure? unauthorized}) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    case DioExceptionType.badResponse:
      final status = e.response?.statusCode;
      final message = _extractMessage(e.response?.data) ?? 'Erro no servidor.';
      if (status == 401) return unauthorized ?? const UnauthorizedFailure();
      if (status == 400 || status == 409 || status == 422) return ValidationFailure(message);
      return ServerFailure(message, statusCode: status);
    default:
      return const UnknownFailure();
  }
}

/// Extrai a mensagem do envelope de erro da API (`{ error: { message } }`).
String? _extractMessage(dynamic data) {
  if (data is Map<String, dynamic>) {
    final error = data['error'];
    if (error is Map<String, dynamic> && error['message'] is String) {
      return error['message'] as String;
    }
    if (data['message'] is String) return data['message'] as String;
  }
  return null;
}
