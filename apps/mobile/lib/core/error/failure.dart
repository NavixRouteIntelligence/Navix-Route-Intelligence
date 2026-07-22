import 'package:equatable/equatable.dart';

/// Falha de domínio, apresentável ao usuário. A camada de dados converte
/// exceções (rede, cache, auth) nestes tipos; a UI nunca vê exceções cruas.
sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sem conexão com o servidor.']);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.statusCode});
  final int? statusCode;

  @override
  List<Object?> get props => [message, statusCode];
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure([super.message = 'Sessão expirada.']);
}

/// 401 vindo do **login/registro**: não havia sessão para expirar — a credencial
/// é que foi rejeitada. Distinguir de [UnauthorizedFailure] evita dizer "Sessão
/// expirada" a quem acabou de errar a senha.
class InvalidCredentialsFailure extends Failure {
  const InvalidCredentialsFailure([super.message = 'E-mail ou senha incorretos.']);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Falha ao acessar dados locais.']);
}

class UnknownFailure extends Failure {
  const UnknownFailure([super.message = 'Ocorreu um erro inesperado.']);
}
