import 'dart:developer' as developer;

/// Níveis de log em ordem de severidade.
enum LogLevel { debug, info, warning, error }

/// Logger simples e sem dependências, com redaction básica de dados sensíveis.
/// Em produção só emite `warning`/`error`; o ponto de integração com telemetria
/// (ex.: Sentry) fica em [AppLogger.onRecord].
class AppLogger {
  AppLogger({required this.enabled, this.minLevel = LogLevel.debug});

  final bool enabled;
  final LogLevel minLevel;

  /// Gancho opcional para telemetria externa (crash/observabilidade).
  void Function(LogLevel level, String message, Object? error, StackTrace? stack)? onRecord;

  static final RegExp _sensitive = RegExp(
    r'(authorization|bearer|password|token|refresh)[^,}\s]*',
    caseSensitive: false,
  );

  String _redact(String input) => input.replaceAll(_sensitive, '[REDACTED]');

  void debug(String message) => _log(LogLevel.debug, message);
  void info(String message) => _log(LogLevel.info, message);
  void warning(String message, [Object? error, StackTrace? stack]) =>
      _log(LogLevel.warning, message, error, stack);
  void error(String message, [Object? error, StackTrace? stack]) =>
      _log(LogLevel.error, message, error, stack);

  void _log(LogLevel level, String message, [Object? error, StackTrace? stack]) {
    if (!enabled || level.index < minLevel.index) return;
    final safe = _redact(message);
    developer.log(
      safe,
      name: 'navix.${level.name}',
      level: _sysLevel(level),
      error: error,
      stackTrace: stack,
    );
    onRecord?.call(level, safe, error, stack);
  }

  int _sysLevel(LogLevel level) => switch (level) {
        LogLevel.debug => 500,
        LogLevel.info => 800,
        LogLevel.warning => 900,
        LogLevel.error => 1000,
      };
}
