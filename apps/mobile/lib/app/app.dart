import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_config.dart';
import '../core/session/session_cubit.dart';
import '../core/session/session_state.dart';
import '../core/theme/theme_cubit.dart';
import '../l10n/gen/app_localizations.dart';
import 'router/app_router.dart';
import 'splash/splash_gate.dart';
import 'theme/app_theme.dart';

/// Raiz do app: tema, i18n e roteamento. Recebe as dependências já resolvidas.
class NavixApp extends StatefulWidget {
  const NavixApp({super.key, required this.config, required this.session});

  final AppConfig config;
  final SessionCubit session;

  @override
  State<NavixApp> createState() => _NavixAppState();
}

class _NavixAppState extends State<NavixApp> {
  late final GoRouter _router = createRouter(widget.session);
  final ThemeCubit _theme = GetIt.instance<ThemeCubit>();

  @override
  void initState() {
    super.initState();
    widget.session.bootstrap();
    _theme.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ThemeCubit, ThemeMode>(
      bloc: _theme,
      builder: (context, mode) => MaterialApp.router(
        title: widget.config.appName,
        debugShowCheckedModeBanner: !widget.config.isProd,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        routerConfig: _router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // A abertura fica ACIMA do roteador: o app monta e restaura a sessão
        // por baixo enquanto a encenação acontece, então ela não acrescenta
        // tempo de partida — só ocupa o tempo que já era de carregamento.
        builder: (context, child) => BlocBuilder<SessionCubit, SessionState>(
          bloc: widget.session,
          builder: (context, s) => SplashGate(
            isDataReady: s.status != SessionStatus.unknown,
            child: child ?? const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}
