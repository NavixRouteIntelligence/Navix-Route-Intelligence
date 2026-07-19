import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/theme/theme_cubit.dart';
import '../../../l10n/gen/app_localizations.dart';
import 'deliveries_cubit.dart';
import 'widgets/deliveries_list_view.dart';

/// Aba "Entregas" do CompanyShell. Casca fina sobre [DeliveriesListView] — o
/// conteúdo é compartilhado com o Motorista (S1). A RLS escopa por tenant.
class CompanyDeliveriesPage extends StatelessWidget {
  const CompanyDeliveriesPage({super.key});

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
