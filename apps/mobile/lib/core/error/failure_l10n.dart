import 'package:flutter/widgets.dart';

import '../../l10n/gen/app_localizations.dart';
import '../location/location_service.dart';
import 'failure.dart';

/// Traduz uma [Failure] para o idioma de quem está usando o app.
///
/// A ponte fica aqui, na apresentação, e não dentro da [Failure]: o domínio
/// continua sem depender de `BuildContext` nem do ARB, e o texto é resolvido no
/// ponto de exibição — o único lugar onde o locale é conhecido e onde uma troca
/// de idioma em tempo de execução reflete de imediato.
extension FailureL10n on Failure {
  /// Texto pronto para exibir. Falhas com [Failure.detail] do servidor mostram
  /// o detalhe (é mais específico do que qualquer texto genérico nosso);
  /// as demais usam o texto localizado do tipo.
  String localizedMessage(AppLocalizations l10n) => switch (this) {
        NetworkFailure() => l10n.errorNetwork,
        UnauthorizedFailure() => l10n.errorSessionExpired,
        InvalidCredentialsFailure() => l10n.loginInvalidCredentials,
        CacheFailure() => l10n.errorCache,
        LocationFailure(:final reason) => switch (reason) {
            LocationErrorReason.serviceDisabled => l10n.errorLocationDisabled,
            LocationErrorReason.permissionDenied => l10n.errorLocationDenied,
            LocationErrorReason.permissionBlocked => l10n.errorLocationBlocked,
          },
        ServerFailure(:final detail) => detail ?? l10n.errorServer,
        ValidationFailure(:final detail) => detail ?? l10n.errorValidation,
        OptimizationTimeoutFailure() => l10n.errorOptimizationTimeout,
        UnknownFailure() => l10n.errorUnknown,
      };
}

/// Açúcar para o caso comum: `context.failureText(state.error!)`.
extension FailureContextL10n on BuildContext {
  String failureText(Failure failure) => failure.localizedMessage(AppLocalizations.of(this));
}
