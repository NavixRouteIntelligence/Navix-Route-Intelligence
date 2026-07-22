import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../logging/app_logger.dart';

/// Centraliza a captura de erros não tratados (Flutter + zona assíncrona) e
/// define um widget de erro amigável no lugar do "tela vermelha" padrão.
class AppErrorHandler {
  AppErrorHandler(this._logger);

  final AppLogger _logger;

  /// Registra os hooks globais. Deve ser chamado no bootstrap, dentro da mesma
  /// zona protegida por `runZonedGuarded`.
  void install() {
    FlutterError.onError = (FlutterErrorDetails details) {
      _logger.error('FlutterError: ${details.exceptionAsString()}', details.exception, details.stack);
      // Sem isto o stack trace NUNCA chega ao console: substituir onError
      // desliga a apresentação padrão do Flutter, e um crash de árvore vira uma
      // tela cinza sem diagnóstico. Fora de release, sempre apresentar.
      if (!kReleaseMode) FlutterError.presentError(details);
    };

    // Erros da plataforma (engine) que não passam pelo Flutter framework.
    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      _logger.error('PlatformDispatcher error', error, stack);
      return true;
    };

    // Substitui a tela vermelha por um placeholder discreto.
    ErrorWidget.builder = (FlutterErrorDetails details) => _FriendlyErrorWidget(
          message: kReleaseMode ? 'Algo deu errado.' : details.exceptionAsString(),
        );
  }

  /// Reporta um erro capturado manualmente (ex.: em `runZonedGuarded`).
  void report(Object error, StackTrace stack) {
    _logger.error('Uncaught zone error', error, stack);
  }
}

class _FriendlyErrorWidget extends StatelessWidget {
  const _FriendlyErrorWidget({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
