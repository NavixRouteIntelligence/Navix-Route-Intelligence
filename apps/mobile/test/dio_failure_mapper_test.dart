import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/network/dio_failure_mapper.dart';

DioException _badResponse(int status, {Object? data}) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(requestOptions: req, statusCode: status, data: data),
  );
}

void main() {
  group('mapDioException', () {
    test('401 sem override continua sendo sessão expirada', () {
      expect(mapDioException(_badResponse(401)), isA<UnauthorizedFailure>());
    });

    test('401 com override vira credencial inválida (login/registro)', () {
      final f = mapDioException(
        _badResponse(401),
        unauthorized: const InvalidCredentialsFailure(),
      );
      expect(f, isA<InvalidCredentialsFailure>());
    });

    test('o override não afeta outros status', () {
      final f = mapDioException(
        _badResponse(400, data: {
          'error': {'message': 'Bad Request Exception'}
        }),
        unauthorized: const InvalidCredentialsFailure(),
      );
      expect(f, isA<ValidationFailure>());
      expect(f.detail, 'Bad Request Exception');
    });

    test('erro de conexão continua sendo falha de rede', () {
      final f = mapDioException(DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError,
      ));
      expect(f, isA<NetworkFailure>());
    });
  });
}
