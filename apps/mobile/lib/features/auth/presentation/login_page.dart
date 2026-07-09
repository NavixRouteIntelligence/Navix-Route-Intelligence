import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/session/session_cubit.dart';
import '../../../core/session/session_state.dart';
import '../../../core/ui/navix_button.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Login (andaime): seleciona o perfil para entrar. A integração real com a API
/// (e-mail/senha/tenant, refresh, secure storage) entra na slice de Auth.
class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = GetIt.instance<SessionCubit>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.appTitle, style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 4),
                  Text(l10n.loginSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 32),
                  NavixButton(
                    label: l10n.signInAsDriver,
                    icon: Icons.local_shipping_outlined,
                    onPressed: () => session.signInAs(UserRole.driver),
                  ),
                  const SizedBox(height: 12),
                  NavixButton(
                    label: l10n.signInAsCompany,
                    variant: NavixButtonVariant.outline,
                    icon: Icons.apartment_outlined,
                    onPressed: () => session.signInAs(UserRole.company),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
