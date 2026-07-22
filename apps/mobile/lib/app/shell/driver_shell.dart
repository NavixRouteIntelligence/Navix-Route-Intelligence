import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/session/session_cubit.dart';
import '../../features/deliveries/presentation/driver_deliveries_page.dart';
import '../../features/driver/presentation/driver_dashboard_page.dart';
import '../../features/finance/presentation/finance_page.dart';
import '../../features/maintenance/presentation/maintenance_page.dart';
import '../../l10n/gen/app_localizations.dart';
import 'adaptive_nav_scaffold.dart';
import 'coming_soon_page.dart';
import 'nav_header.dart';

/// Casca de navegação do Motorista sobre o componente adaptativo único
/// ([AdaptiveNavScaffold]): Bottom Navigation + Drawer no phone, Navigation Rail
/// no tablet. Abas primárias em IndexedStack (estado preservado); o menu lateral
/// completo usa as mesmas telas/rotas — sem alterar lógica de negócio.
class DriverShell extends StatelessWidget {
  const DriverShell({super.key});

  void _push(BuildContext context, Widget page) {
    Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final tabs = [
      NavTab(icon: Icons.navigation_outlined, selectedIcon: Icons.navigation, label: l10n.navRoute, page: const DriverDashboardPage()),
      NavTab(icon: Icons.inventory_2_outlined, selectedIcon: Icons.inventory_2, label: l10n.navDeliveries, page: const DriverDeliveriesPage()),
      NavTab(icon: Icons.directions_car_outlined, selectedIcon: Icons.directions_car, label: l10n.navVehicle, page: const MaintenancePage()),
      NavTab(icon: Icons.account_balance_wallet_outlined, selectedIcon: Icons.account_balance_wallet, label: l10n.navFinance, page: const FinancePage()),
    ];

    final menu = [
      NavMenuEntry(icon: Icons.navigation_outlined, label: l10n.navRoute, tabIndex: 0),
      NavMenuEntry(icon: Icons.inventory_2_outlined, label: l10n.navDeliveries, tabIndex: 1),
      NavMenuEntry(icon: Icons.directions_car_outlined, label: l10n.navVehicle, tabIndex: 2),
      NavMenuEntry(icon: Icons.account_balance_wallet_outlined, label: l10n.navFinance, tabIndex: 3),
      const NavMenuEntry.divider(),
      // Manutenção mora na tela do Veículo (aba Veículo) — combinadas hoje.
      NavMenuEntry(icon: Icons.build_outlined, label: l10n.navMaintenance, tabIndex: 2),
      NavMenuEntry(icon: Icons.insights_outlined, label: l10n.navStatistics, onTap: () => _push(context, ComingSoonPage(title: l10n.navStatistics, icon: Icons.insights_outlined))),
      NavMenuEntry(icon: Icons.notifications_outlined, label: l10n.navNotifications, onTap: () => _push(context, ComingSoonPage(title: l10n.navNotifications, icon: Icons.notifications_outlined))),
      NavMenuEntry(icon: Icons.settings_outlined, label: l10n.navSettings, onTap: () => _push(context, ComingSoonPage(title: l10n.navSettings, icon: Icons.settings_outlined))),
      const NavMenuEntry.divider(),
      NavMenuEntry(icon: Icons.logout, label: l10n.signOut, danger: true, onTap: () => GetIt.instance<SessionCubit>().logout()),
    ];

    return AdaptiveNavScaffold(
      tabs: tabs,
      menu: menu,
      header: const NavHeader(showLiveStatus: true),
    );
  }
}
