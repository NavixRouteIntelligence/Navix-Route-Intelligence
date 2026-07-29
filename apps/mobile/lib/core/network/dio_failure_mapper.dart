import 'package:dio/dio.dart';

import '../error/failure.dart';

/// Converte uma [DioException] na [Failure] de domínio correspondente.
///
/// [unauthorized] permite ao chamador trocar o significado do 401: em endpoints
/// autenticados ele é "sessão expirada" (padrão), mas no login/registro é
/// "credencial inválida" — não havia sessão para expirar. [notFound] faz o
/// mesmo com o 404, que no convite significa "link inválido ou expirado" e não
/// um erro de servidor.
Failure mapDioException(DioException e, {Failure? unauthorized, Failure? notFound}) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    case DioExceptionType.badResponse:
      final status = e.response?.statusCode;
      // Sem mensagem da API o detalhe fica nulo: a UI cai no texto localizado
      // do tipo, em vez de um "Erro no servidor." fixo em português.
      final detail = _extractMessage(e.response?.data);
      if (status == 401) return unauthorized ?? const UnauthorizedFailure();
      if (status == 404 && notFound != null) return notFound;
      if (status == 400 || status == 409 || status == 422) {
        return ValidationFailure(detail);
      }
      return ServerFailure(detail, status);
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
