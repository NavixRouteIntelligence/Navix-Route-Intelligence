import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/session/session_cubit.dart';
import '../../features/dashboard/presentation/company_dashboard_page.dart';
import '../../features/deliveries/presentation/company_deliveries_page.dart';
import '../../features/imports/presentation/import_center_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/tracking/presentation/fleet_tracking_page.dart';
import '../../l10n/gen/app_localizations.dart';
import 'adaptive_nav_scaffold.dart';
import 'coming_soon_page.dart';
import 'nav_header.dart';

/// Casca de navegação da Empresa sobre o mesmo componente adaptativo único
/// ([AdaptiveNavScaffold]) do Motorista (ADR-0072): Bottom Navigation + Drawer
/// no phone, Navigation Rail no tablet. Difere só na configuração de abas/menu
/// (respeitando as diferenças de perfil) — sem alterar lógica de negócio.
class CompanyShell extends StatelessWidget {
  const CompanyShell({super.key});

  void _push(BuildContext context, Widget page) {
    Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final tabs = [
      NavTab(icon: Icons.dashboard_outlined, selectedIcon: Icons.dashboard, label: l10n.navDashboard, page: const CompanyDashboardPage()),
      NavTab(icon: Icons.inventory_2_outlined, selectedIcon: Icons.inventory_2, label: l10n.navDeliveries, page: const CompanyDeliveriesPage()),
      NavTab(icon: Icons.upload_file_outlined, selectedIcon: Icons.upload_file, label: l10n.navImports, page: const ImportCenterPage()),
      NavTab(icon: Icons.podcasts_outlined, selectedIcon: Icons.podcasts, label: l10n.navTracking, page: const FleetTrackingPage()),
    ];

    final menu = [
      NavMenuEntry(icon: Icons.dashboard_outlined, label: l10n.navDashboard, tabIndex: 0),
      NavMenuEntry(icon: Icons.inventory_2_outlined, label: l10n.navDeliveries, tabIndex: 1),
      NavMenuEntry(icon: Icons.upload_file_outlined, label: l10n.navImports, tabIndex: 2),
      NavMenuEntry(icon: Icons.podcasts_outlined, label: l10n.navTracking, tabIndex: 3),
      const NavMenuEntry.divider(),
      NavMenuEntry(icon: Icons.person_outline, label: l10n.navProfile, onTap: () => _push(context, const ProfilePage())),
      NavMenuEntry(icon: Icons.settings_outlined, label: l10n.navSettings, onTap: () => _push(context, ComingSoonPage(title: l10n.navSettings, icon: Icons.settings_outlined))),
      const NavMenuEntry.divider(),
      NavMenuEntry(icon: Icons.logout, label: l10n.signOut, danger: true, onTap: () => GetIt.instance<SessionCubit>().logout()),
    ];

    return AdaptiveNavScaffold(
      tabs: tabs,
      menu: menu,
      header: const NavHeader(showLiveStatus: false),
    );
  }
}
