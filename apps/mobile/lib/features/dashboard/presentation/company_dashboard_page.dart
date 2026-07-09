import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../core/ui/navix_bar_chart.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_donut.dart';
import '../../../core/ui/navix_kpi_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../domain/dashboard_data.dart';
import 'dashboard_cubit.dart';

/// Painel da Empresa — layout aprovado (KPIs, desempenho, POD, frota) com
/// estados de loading/empty/error e micro-animações.
class CompanyDashboardPage extends StatelessWidget {
  const CompanyDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<DashboardCubit>()..load(),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    final theme = GetIt.instance<ThemeCubit>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Tema',
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
      body: BlocBuilder<DashboardCubit, DashboardState>(
        builder: (context, state) {
          final child = switch (state.status) {
            DashboardStatus.loading => const _LoadingView(),
            DashboardStatus.error => NavixErrorState(
                description: state.error ?? 'Não foi possível carregar.',
                onRetry: () => context.read<DashboardCubit>().load(),
              ),
            DashboardStatus.success => (state.data?.isEmpty ?? true)
                ? const NavixEmptyState(
                    icon: Icons.insights_outlined,
                    title: 'Sem dados ainda',
                    description: 'Cadastre entregas e otimize rotas para ver seus indicadores.',
                  )
                : _Content(data: state.data!),
          };
          return AnimatedSwitcher(
            duration: context.tokens.motionBase,
            child: KeyedSubtree(key: ValueKey(state.status), child: child),
          );
        },
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.data});
  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    final series = data.perfSeries.isEmpty ? <double>[0] : data.perfSeries;

    return RefreshIndicator(
      onRefresh: () => context.read<DashboardCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.7,
            children: [
              NavixKpiCard(icon: Icons.inventory_2_outlined, label: 'Entregas', value: '${data.deliveries.total}', iconColor: primary),
              NavixKpiCard(icon: Icons.route_outlined, label: 'Rotas otimizadas', value: '${data.routesTotal}', iconColor: t.accent),
              NavixKpiCard(icon: Icons.local_gas_station_outlined, label: 'Economia', value: '${data.savedKm.toStringAsFixed(0)} km', iconColor: t.warning),
              NavixKpiCard(icon: Icons.speed_outlined, label: 'Score médio', value: '${data.avgScore}', iconColor: primary),
            ],
          ),
          const SizedBox(height: 16),
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const NavixSectionHeader(title: 'Desempenho — distância otimizada'),
                NavixBarChart(
                  values: series,
                  labels: List.generate(series.length, (i) => '${i + 1}'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const NavixSectionHeader(title: 'Comprovantes (POD)', icon: Icons.fact_check_outlined),
                Row(
                  children: [
                    NavixDonut(
                      centerValue: '${data.pod.total}',
                      centerLabel: 'total',
                      segments: [
                        DonutSegment(data.pod.delivered.toDouble(), t.success),
                        DonutSegment(data.pod.absent.toDouble(), t.warning),
                        DonutSegment(data.pod.refused.toDouble(), t.danger),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        children: [
                          _LegendRow(color: t.success, label: 'Entregues', value: data.pod.delivered),
                          _LegendRow(color: t.warning, label: 'Ausentes', value: data.pod.absent),
                          _LegendRow(color: t.danger, label: 'Recusados', value: data.pod.refused),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NavixSectionHeader(
                  title: 'Frota ao vivo',
                  icon: Icons.podcasts_outlined,
                  trailing: NavixStatusPill(
                    label: '${data.fleet.where((f) => f.status == 'en_route').length} em rota',
                    color: t.accent,
                  ),
                ),
                if (data.fleet.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text('Nenhum motorista rastreado.', style: TextStyle(color: t.muted)),
                  )
                else
                  ...data.fleet.take(6).map((f) => _FleetRow(driver: f)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.color, required this.label, required this.value});
  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: TextStyle(color: t.muted, fontSize: 12.5))),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _FleetRow extends StatelessWidget {
  const _FleetRow({required this.driver});
  final FleetDriver driver;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (color, label) = switch (driver.status) {
      'en_route' => (t.accent, 'Em rota'),
      'finished' => (Theme.of(context).colorScheme.primary, 'Finalizado'),
      _ => (t.muted, 'Offline'),
    };
    final short = driver.id.length >= 8 ? driver.id.substring(0, 8) : driver.id;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(child: Text(short, style: const TextStyle(fontFamily: 'monospace', fontSize: 12.5))),
          NavixStatusPill(label: label, color: color),
        ],
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.7,
          children: List.generate(4, (_) => const NavixCard(child: NavixSkeleton(height: 60))),
        ),
        const SizedBox(height: 16),
        const NavixCard(child: NavixSkeleton(height: 150)),
        const SizedBox(height: 16),
        const NavixCard(child: NavixSkeleton(height: 110)),
      ],
    );
  }
}
