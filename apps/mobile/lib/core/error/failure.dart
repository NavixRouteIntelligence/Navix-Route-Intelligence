import 'package:equatable/equatable.dart';

import '../location/location_service.dart';

/// Falha de domínio, apresentável ao usuário. A camada de dados converte
/// exceções (rede, cache, auth) nestes tipos; a UI nunca vê exceções cruas.
///
/// A falha é um **tipo**, não um texto: o app suporta 5 locales e o domínio não
/// conhece o locale de quem está usando. O texto sai de `localizedMessage`
/// (`core/error/failure_l10n.dart`), no ponto de exibição, onde há `context`.
///
/// [detail] é o complemento que só o servidor conhece (ex.: qual campo falhou
/// na validação). Vem da API no idioma que ela escolher e é opcional: quando
/// nulo, a UI mostra só o texto localizado do tipo.
sealed class Failure extends Equatable {
  const Failure([this.detail]);
  final String? detail;

  @override
  List<Object?> get props => [detail];
}

class NetworkFailure extends Failure {
  const NetworkFailure();
}

class ServerFailure extends Failure {
  const ServerFailure([super.detail, this.statusCode]);
  final int? statusCode;

  @override
  List<Object?> get props => [detail, statusCode];
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure();
}

/// 401 vindo do **login/registro**: não havia sessão para expirar — a credencial
/// é que foi rejeitada. Distinguir de [UnauthorizedFailure] evita dizer "Sessão
/// expirada" a quem acabou de errar a senha.
class InvalidCredentialsFailure extends Failure {
  const InvalidCredentialsFailure();
}

class ValidationFailure extends Failure {
  const ValidationFailure([super.detail]);
}

class CacheFailure extends Failure {
  const CacheFailure();
}

/// Localização indisponível. Carrega o motivo porque cada caso pede uma ação
/// diferente: ligar o GPS não é o mesmo que liberar a permissão nas
/// configurações.
class LocationFailure extends Failure {
  const LocationFailure(this.reason);
  final LocationErrorReason reason;

  @override
  List<Object?> get props => [reason];
}

/// A otimização não respondeu dentro da janela de polling. É o único caso em
/// que o app desiste de esperar por conta própria — merece um texto que diga
/// para tentar de novo, e não um erro de servidor genérico.
class OptimizationTimeoutFailure extends Failure {
  const OptimizationTimeoutFailure();
}

class UnknownFailure extends Failure {
  const UnknownFailure();
}
