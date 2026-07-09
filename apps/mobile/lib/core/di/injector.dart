import 'package:get_it/get_it.dart';

import '../config/app_config.dart';
import '../error/error_handler.dart';
import '../logging/app_logger.dart';
import '../session/session_cubit.dart';

/// Container global de injeção de dependências.
final GetIt getIt = GetIt.instance;

/// Registra as dependências transversais. Cada feature adiciona as suas ao
/// evoluir (repositórios, data sources, blocs) — este é o ponto único de wiring.
Future<void> configureDependencies(AppConfig config) async {
  getIt
    ..registerSingleton<AppConfig>(config)
    ..registerSingleton<AppLogger>(
      AppLogger(
        enabled: config.enableLogging,
        minLevel: config.isProd ? LogLevel.warning : LogLevel.debug,
      ),
    )
    ..registerSingleton<AppErrorHandler>(AppErrorHandler(getIt<AppLogger>()))
    ..registerLazySingleton<SessionCubit>(() => SessionCubit(getIt<AppLogger>()));
}
