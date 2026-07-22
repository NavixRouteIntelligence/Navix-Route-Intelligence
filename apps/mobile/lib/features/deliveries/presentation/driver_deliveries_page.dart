import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../imports/presentation/import_center_page.dart';
import 'deliveries_cubit.dart';
import 'widgets/deliveries_list_view.dart';
import 'widgets/import_fab.dart';

/// Aba "Entregas" do DriverShell (S1 + S2). Casca fina sobre [DeliveriesListView],
/// idêntica à da Empresa no conteúdo — o motorista autônomo vê as próprias
/// entregas (mesmo endpoint `GET /deliveries`, escopado por tenant via RLS).
///
/// S2: a ação "Importar" mora AQUI (FAB), não numa 4ª aba — o motorista opera
/// dirigindo, então a navegação fica enxuta. O FAB abre a `ImportCenterPage`
/// existente; ao voltar, a lista recarrega para mostrar as entregas criadas.
class DriverDeliveriesPage extends StatelessWidget {
  const DriverDeliveriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = GetIt.instance<ThemeCubit>();
    return BlocProvider(
      create: (_) => GetIt.instance<DeliveriesCubit>()..load(),
      child: Builder(
        // Builder para obter um context ABAIXO do BlocProvider (lê o cubit no FAB).
        builder: (context) => Scaffold(
          appBar: AppBar(
            leading: const NavLeading(),
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
          floatingActionButton: ImportFab(onPressed: () => _openImport(context)),
          body: const DeliveriesListView(),
        ),
      ),
    );
  }

  /// Abre o Import Center e, ao retornar, recarrega a lista — as entregas
  /// recém-importadas aparecem sem o motorista precisar puxar para atualizar.
  Future<void> _openImport(BuildContext context) async {
    final cubit = context.read<DeliveriesCubit>();
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const ImportCenterPage()),
    );
    await cubit.load();
  }
}
