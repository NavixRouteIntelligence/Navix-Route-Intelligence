import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/session/session_cubit.dart';
import '../../../core/session/session_state.dart';
import '../../../core/ui/navix_button.dart';
import '../../../core/ui/navix_card.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../maintenance/presentation/maintenance_page.dart';

/// Perfil com identidade da sessão (RBAC) e logout.
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = GetIt.instance<SessionCubit>();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: BlocBuilder<SessionCubit, SessionState>(
          bloc: session,
          builder: (context, state) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              NavixCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(state.email ?? '—', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      state.role == UserRole.driver ? l10n.accountDriver : l10n.accountCompany,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (state.role == UserRole.driver) ...[
                NavixCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.build_outlined),
                    title: Text(l10n.maintTitle),
                    subtitle: Text(l10n.profileMaintenanceSubtitle),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(builder: (_) => const MaintenancePage()),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              NavixButton(
                label: l10n.signOut,
                variant: NavixButtonVariant.outline,
                icon: Icons.logout,
                onPressed: () => session.logout(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
