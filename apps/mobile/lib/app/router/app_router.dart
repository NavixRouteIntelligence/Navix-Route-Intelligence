import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../../core/session/session_cubit.dart';
import '../../core/session/session_state.dart';
import '../../features/auth/presentation/login_page.dart';
import '../shell/company_shell.dart';
import '../shell/driver_shell.dart';

/// Listenable que notifica o go_router a cada evento de um stream (a sessão).
/// Implementação própria para não depender de utilitários que mudam entre
/// versões do go_router.
class _StreamRefresh extends ChangeNotifier {
  _StreamRefresh(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

/// Rotas nomeadas do app.
abstract final class Routes {
  static const login = '/login';
  static const driver = '/driver';
  static const dashboard = '/dashboard';
}

/// Cria o [GoRouter] com guarda por sessão/papel (RBAC). A navegação reage às
/// mudanças de sessão via [GoRouterRefreshStream] ligado ao [SessionCubit].
GoRouter createRouter(SessionCubit session) {
  return GoRouter(
    initialLocation: Routes.login,
    refreshListenable: _StreamRefresh(session.stream),
    redirect: (context, state) {
      final s = session.state;
      final loc = state.matchedLocation;
      final atLogin = loc == Routes.login;

      // Ainda restaurando a sessão: não redireciona.
      if (s.status == SessionStatus.unknown) return null;

      // Não autenticado → login.
      if (!s.isAuthenticated) return atLogin ? null : Routes.login;

      // Autenticado: destino conforme o perfil.
      final home = s.isDriver ? Routes.driver : Routes.dashboard;
      if (atLogin) return home;

      // Isolamento por papel (motorista × empresa).
      final onDriver = loc.startsWith(Routes.driver);
      if (s.isDriver && !onDriver) return Routes.driver;
      if (!s.isDriver && onDriver) return Routes.dashboard;

      return null;
    },
    routes: [
      GoRoute(path: Routes.login, builder: (_, __) => const LoginPage()),
      GoRoute(path: Routes.driver, builder: (_, __) => const DriverShell()),
      GoRoute(path: Routes.dashboard, builder: (_, __) => const CompanyShell()),
    ],
  );
}
