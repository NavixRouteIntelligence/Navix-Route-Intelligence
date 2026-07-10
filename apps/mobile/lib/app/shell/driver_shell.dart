import 'package:flutter/material.dart';

import '../../core/ui/placeholder_page.dart';
import '../../features/driver/presentation/driver_dashboard_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../l10n/gen/app_localizations.dart';

/// Casca de navegação do Motorista (Rota, Entregas, Perfil).
/// Na fase de features migra para StatefulShellRoute (deep links por aba).
class DriverShell extends StatefulWidget {
  const DriverShell({super.key});

  @override
  State<DriverShell> createState() => _DriverShellState();
}

class _DriverShellState extends State<DriverShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final pages = [
      const DriverDashboardPage(),
      PlaceholderPage(title: l10n.navDeliveries, icon: Icons.inventory_2_outlined),
      const ProfilePage(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.navigation_outlined), label: l10n.navRoute),
          NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), label: l10n.navDeliveries),
          NavigationDestination(icon: const Icon(Icons.person_outline), label: l10n.navProfile),
        ],
      ),
    );
  }
}
