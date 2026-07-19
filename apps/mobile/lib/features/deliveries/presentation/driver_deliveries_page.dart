import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/theme/theme_cubit.dart';
import '../../../l10n/gen/app_localizations.dart';
import 'deliveries_cubit.dart';
import 'widgets/deliveries_list_view.dart';

/// Aba "Entregas" do DriverShell (S1). Casca fina sobre [DeliveriesListView],
/// idêntica à da Empresa no conteúdo — o motorista autônomo vê as próprias
/// entregas (mesmo endpoint `GET /deliveries`, escopado por tenant via RLS).
/// A diferença entre os perfis é só a casca; a lista é compartilhada.
class DriverDeliveriesPage extends StatelessWidget {
  const DriverDeliveriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = GetIt.instance<ThemeCubit>();
    return BlocProvider(
      create: (_) => GetIt.instance<DeliveriesCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.navDeliveries),
          actions: [
            IconButton(
              tooltip: l10n.themeToggle,
              onPressed: () {
                final dark = Theme.of(context).brightness == Brightness.dark;
                theme.setMode(dark ? ThemeMode.light : ThemeMode.dark);
              },
              icon: Icon(Theme.of(context).brightness == Brightness.dark
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined),
            ),
          ],
        ),
        body: const DeliveriesListView(),
      ),
    );
  }
}
