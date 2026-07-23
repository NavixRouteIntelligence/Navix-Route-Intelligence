import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../core/ui/navix_button.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_donut.dart';
import '../../../core/ui/navix_dual_bars.dart';
import '../../../core/ui/navix_kpi_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../../optimizer/presentation/optimizer_page.dart';
import '../domain/dashboard_data.dart';
import 'dashboard_cubit.dart';

/// Painel da Empresa — layout do protótipo aprovado (KPIs, analytics, IA insights,
/// tracking, route optimizer, import center, fleet, delivery) com estados de
/// loading/empty/error e micro-animações.
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
                description: context.failureText(state.error ?? const UnknownFailure()),
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

  void _openOptimizer(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OptimizerPage()));
  }

  void _soon(BuildContext context, String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    final planned = data.perfPlanned.isEmpty ? <double>[0] : data.perfPlanned;
    final optimized = data.perfOptimized.isEmpty ? <double>[0] : data.perfOptimized;

    return RefreshIndicator(
      onRefresh: () => context.read<DashboardCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Ações rápidas (1 toque).
          Row(
            children: [
              Expanded(
                child: NavixButton(
                  label: 'Importar',
                  variant: NavixButtonVariant.outline,
                  icon: Icons.upload_outlined,
                  onPressed: () => _soon(context, 'Import Center em breve no app.'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NavixButton(
                  label: 'Otimizar',
                  icon: Icons.bolt_outlined,
                  onPressed: () => _openOptimizer(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // KPIs.
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
              NavixKpiCard(
                icon: Icons.local_gas_station_outlined,
                label: 'Economia',
                value: '${data.savedKm.toStringAsFixed(0)} km',
                iconColor: t.warning,
                deltaLabel: data.avgSavingsPct > 0 ? '${data.avgSavingsPct.toStringAsFixed(0)}%' : null,
              ),
              NavixKpiCard(icon: Icons.check_circle_outline, label: 'Taxa de conclusão', value: '${data.completionRate.toStringAsFixed(0)}%', iconColor: t.success),
            ],
          ),
          const SizedBox(height: 16),

          // Analytics.
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NavixSectionHeader(
                  title: 'Desempenho',
                  icon: Icons.bar_chart_outlined,
                  trailing: _Legend(colorA: primary, colorB: t.accent),
                ),
                NavixDualBars(
                  seriesA: planned,
                  seriesB: optimized,
                  labels: List.generate(planned.length, (i) => '${i + 1}'),
                  colorA: primary,
                  colorB: t.accent,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // IA Insights.
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const NavixSectionHeader(title: 'IA Insights', icon: Icons.auto_awesome_outlined),
                ..._insights(context, data),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Tracking (frota ao vivo).
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NavixSectionHeader(
                  title: 'Frota ao vivo',
                  icon: Icons.podcasts_outlined,
                  trailing: NavixStatusPill(
                    label: '${data.positions.where((f) => f.status == 'en_route').length} em rota',
                    color: t.accent,
                  ),
                ),
                if (data.positions.isEmpty)
                  Text('Nenhum motorista rastreado.', style: TextStyle(color: t.muted))
                else
                  ...data.positions.take(4).map((f) => _FleetRow(driver: f)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Route Optimizer.
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NavixSectionHeader(
                  title: 'Route Optimizer',
                  icon: Icons.navigation_outlined,
                  trailing: TextButton(
                    onPressed: () => _openOptimizer(context),
                    child: const Text('Otimizar'),
                  ),
                ),
                if (data.recentPlans.isEmpty)
                  Text('Nenhuma rota gerada.', style: TextStyle(color: t.muted))
                else
                  ...data.recentPlans.map((p) => _PlanRow(plan: p)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Import Center.
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NavixSectionHeader(
                  title: 'Import Center',
                  icon: Icons.upload_file_outlined,
                  trailing: TextButton(
                    onPressed: () => _soon(context, 'Import Center em breve no app.'),
                    child: const Text('Importar'),
                  ),
                ),
                if (data.recentImports.isEmpty)
                  Text('Nenhuma importação.', style: TextStyle(color: t.muted))
                else
                  ...data.recentImports.map((b) => _ImportRow(item: b)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Fleet + Delivery.
          NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const NavixSectionHeader(title: 'Frota', icon: Icons.local_shipping_outlined),
                Row(
                  children: [
                    Expanded(child: _MiniStat(value: '${data.fleet.activeVehicles}/${data.fleet.totalVehicles}', label: 'Veículos ativos')),
                    const SizedBox(width: 10),
                    Expanded(child: _MiniStat(value: '${data.fleet.activeDrivers}/${data.fleet.totalDrivers}', label: 'Motoristas ativos')),
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
                NavixSectionHeader(title: 'Entregas por status', icon: Icons.donut_large_outlined, trailing: Text('${data.deliveries.total} total', style: TextStyle(color: t.muted, fontSize: 12))),
                Row(
                  children: [
                    NavixDonut(
                      centerValue: '${data.deliveries.delivered}',
                      centerLabel: 'entregues',
                      segments: [
                        DonutSegment(data.deliveries.delivered.toDouble(), t.success),
                        DonutSegment(data.deliveries.inRoute.toDouble(), primary),
                        DonutSegment(data.deliveries.pending.toDouble(), t.warning),
                        DonutSegment(data.deliveries.failed.toDouble(), t.danger),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        children: [
                          _LegendRow(color: t.success, label: 'Entregue', value: data.deliveries.delivered),
                          _LegendRow(color: primary, label: 'Em rota', value: data.deliveries.inRoute),
                          _LegendRow(color: t.warning, label: 'Pendente', value: data.deliveries.pending),
                          _LegendRow(color: t.danger, label: 'Falhou', value: data.deliveries.failed),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _insights(BuildContext context, DashboardData d) {
    final t = context.tokens;
    final items = <(Color, String, String)>[];
    if (d.avgSavingsPct > 0) {
      items.add((t.accent, 'Otimização economiza rota', 'Ganho médio de ${d.avgSavingsPct.toStringAsFixed(0)}% em distância nas rotas.'));
    }
    if (d.deliveries.failed > 0) {
      items.add((t.danger, 'Entregas com falha', '${d.deliveries.failed} entrega(s) falharam — investigue as causas.'));
    }
    final idle = d.fleet.totalVehicles - d.fleet.activeVehicles;
    if (idle > 0) {
      items.add((t.warning, 'Veículos ociosos', '$idle veículo(s) inativo(s) — realoque para reduzir atrasos.'));
    }
    if (items.isEmpty) {
      items.add((t.success, 'Operação saudável', 'Sem alertas no período.'));
    }
    return items
        .take(3)
        .map((i) => _InsightRow(color: i.$1, title: i.$2, description: i.$3))
        .toList();
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.colorA, required this.colorB});
  final Color colorA;
  final Color colorB;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget item(Color c, String l) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 4),
          Text(l, style: TextStyle(fontSize: 11, color: t.muted)),
        ]);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      item(colorA, 'Planejado'),
      const SizedBox(width: 10),
      item(colorB, 'Otimizado'),
    ]);
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({required this.color, required this.title, required this.description});
  final Color color;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 5), decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(description, style: TextStyle(color: t.muted, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanRow extends StatelessWidget {
  const _PlanRow({required this.plan});
  final PlanSummary plan;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final short = plan.id.length >= 8 ? plan.id.substring(0, 8) : plan.id;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rota $short', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text('${plan.stops} paradas', style: TextStyle(color: t.muted, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('−${plan.savingsPct.toStringAsFixed(0)}% km', style: TextStyle(color: t.accent, fontWeight: FontWeight.w700, fontSize: 13)),
              Text('Score ${plan.score}', style: TextStyle(color: t.muted, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ImportRow extends StatelessWidget {
  const _ImportRow({required this.item});
  final ImportSummaryItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final ok = item.total == 0 || item.valid == item.total;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Text(item.filename, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
          NavixStatusPill(label: '${item.valid}/${item.total}', color: ok ? t.success : t.warning),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: t.muted, fontSize: 11)),
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
        const NavixSkeleton(height: 44),
        const SizedBox(height: 16),
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
