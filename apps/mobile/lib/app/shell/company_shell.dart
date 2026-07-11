import 'package:flutter/material.dart';

import '../../core/ui/placeholder_page.dart';
import '../../features/dashboard/presentation/company_dashboard_page.dart';
import '../../features/imports/presentation/import_center_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/tracking/presentation/fleet_tracking_page.dart';
import '../../l10n/gen/app_localizations.dart';

/// Casca de navegação da Empresa (Dashboard, Entregas, Rastreamento, Perfil).
class CompanyShell extends StatefulWidget {
  const CompanyShell({super.key});

  @override
  State<CompanyShell> createState() => _CompanyShellState();
}

class _CompanyShellState extends State<CompanyShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final pages = [
      const CompanyDashboardPage(),
      PlaceholderPage(title: l10n.navDeliveries, icon: Icons.inventory_2_outlined),
      const ImportCenterPage(),
      const FleetTrackingPage(),
      const ProfilePage(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.dashboard_outlined), label: l10n.navDashboard),
          NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), label: l10n.navDeliveries),
          const NavigationDestination(icon: Icon(Icons.upload_file_outlined), label: 'Importar'),
          NavigationDestination(icon: const Icon(Icons.podcasts_outlined), label: l10n.navTracking),
          NavigationDestination(icon: const Icon(Icons.person_outline), label: l10n.navProfile),
        ],
      ),
    );
  }
}
