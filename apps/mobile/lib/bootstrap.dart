import 'dart:async';

import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/config/app_config.dart';
import 'core/di/injector.dart';
import 'core/error/error_handler.dart';
import 'core/session/session_cubit.dart';

/// Ponto de entrada comum dos flavors. Sobe a app dentro de uma zona protegida,
/// instala os hooks globais de erro e resolve as dependências.
Future<void> bootstrap(AppConfig config) async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      await configureDependencies(config);
      getIt<AppErrorHandler>().install();

      runApp(NavixApp(config: config, session: getIt<SessionCubit>()));
    },
    (error, stack) => getIt<AppErrorHandler>().report(error, stack),
  );
}
