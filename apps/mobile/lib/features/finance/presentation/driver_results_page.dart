import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../route/domain/my_route.dart';
import '../../route/presentation/my_route_cubit.dart';

/// Resultados operacionais do motorista: demonstra a eficiência da Navix usando
/// a comparação real entre o baseline e a rota otimizada já devolvida pelo
/// otimizador. Não contém ledger nem permite criar lançamentos financeiros.
class DriverResultsPage extends StatelessWidget {
  const DriverResultsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<MyRouteCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(
          leading: const NavLeading(),
          title: Text(l10n.resultsTitle),
        ),
        body: BlocBuilder<MyRouteCubit, MyRouteState>(
          builder: (context, state) => switch (state.status) {
            MyRouteLoadStatus.loading => const Center(
                child: CircularProgressIndicator(),
              ),
            MyRouteLoadStatus.error => NavixErrorState(
                description: state.error == null
                    ? l10n.routeLoadError
                    : context.failureText(state.error!),
                onRetry: () => context.read<MyRouteCubit>().load(),
              ),
            MyRouteLoadStatus.ready => state.route.isReady
                ? _ResultsContent(route: state.route)
                : NavixEmptyState(
                    icon: Icons.insights_outlined,
                    title: l10n.resultsNoRouteTitle,
                    description: l10n.resultsNoRouteDescription,
                  ),
          },
        ),
      ),
    );
  }
}

class _ResultsContent extends StatelessWidget {
  const _ResultsContent({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () => context.read<MyRouteCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _FuelHero(route: route),
          const SizedBox(height: 20),
          NavixSectionHeader(
            title: l10n.resultsComparisonTitle,
            icon: Icons.compare_arrows,
          ),
          const SizedBox(height: 8),
          _ComparisonCard(route: route),
          const SizedBox(height: 20),
          NavixSectionHeader(
            title: l10n.resultsImpactTitle,
            icon: Icons.auto_graph_outlined,
          ),
          const SizedBox(height: 8),
          _ImpactGrid(route: route),
          const SizedBox(height: 20),
          _DailyProgress(route: route),
        ],
      ),
    );
  }
}

class _FuelHero extends StatelessWidget {
  const _FuelHero({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    final efficiency = route.savedPct;
    final positive = efficiency >= 0;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.34),
            t.accent.withValues(alpha: 0.14),
            scheme.surface,
          ],
          stops: const [0, 0.58, 1],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: scheme.primary.withValues(alpha: 0.38),
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.14),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -28,
            top: -34,
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: t.accent.withValues(alpha: 0.08),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: t.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Icon(
                        Icons.local_gas_station_outlined,
                        color: t.accent,
                        size: 21,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l10n.resultsFuelSaved,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  '${route.fuelSavedLiters.toStringAsFixed(2)} L',
                  style: const TextStyle(
                    fontSize: 36,
                    height: 1,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  route.usesDefaultFuelEstimate
                      ? l10n.resultsFuelDefaultEstimate
                      : l10n.resultsFuelVehicleEstimate,
                  style: TextStyle(fontSize: 11.5, color: t.muted),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.surface.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: t.line),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              positive
                                  ? l10n.resultsMoreEfficient(
                                      efficiency.toStringAsFixed(0),
                                    )
                                  : l10n.resultsLessEfficient(
                                      efficiency.abs().toStringAsFixed(0),
                                    ),
                              style: TextStyle(
                                color: positive ? t.success : t.danger,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          Icon(
                            positive ? Icons.trending_down : Icons.trending_up,
                            size: 18,
                            color: positive ? t.success : t.danger,
                          ),
                        ],
                      ),
                      const SizedBox(height: 9),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: (efficiency.abs() / 100)
                              .clamp(0.0, 1.0)
                              .toDouble(),
                          minHeight: 6,
                          backgroundColor:
                              scheme.onSurface.withValues(alpha: 0.1),
                          valueColor: AlwaysStoppedAnimation(
                            positive ? t.success : t.danger,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ComparisonCard extends StatelessWidget {
  const _ComparisonCard({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;

    return NavixCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: _PlanMetric(
              label: l10n.resultsOriginalOrder,
              distance: route.baselineDistanceKm,
              minutes: route.baselineTimeMinutes,
              color: t.muted,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.13),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.arrow_forward, size: 17, color: t.accent),
            ),
          ),
          Expanded(
            child: _PlanMetric(
              label: l10n.resultsNavixRoute,
              distance: route.distanceKm,
              minutes: route.timeMinutes,
              color: t.success,
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanMetric extends StatelessWidget {
  const _PlanMetric({
    required this.label,
    required this.distance,
    required this.minutes,
    required this.color,
  });

  final String label;
  final double distance;
  final double minutes;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          '${distance.toStringAsFixed(1)} km',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 3),
        Text(
          _duration(minutes),
          style: TextStyle(fontSize: 11.5, color: t.muted),
        ),
      ],
    );
  }
}

class _ImpactGrid extends StatelessWidget {
  const _ImpactGrid({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    final metrics = [
      (
        l10n.resultsDistanceSaved,
        '${route.savedKm.clamp(0, double.infinity).toStringAsFixed(1)} km',
        Icons.route_outlined,
        t.accent,
      ),
      (
        l10n.resultsTimeSaved,
        _duration(route.savedMinutes.clamp(0, double.infinity).toDouble()),
        Icons.schedule_outlined,
        scheme.primary,
      ),
      (
        l10n.resultsFuelSaved,
        '${route.fuelSavedLiters.toStringAsFixed(2)} L',
        Icons.local_gas_station_outlined,
        t.success,
      ),
      (
        l10n.resultsProductivity,
        '${route.savedTimePct >= 0 ? '+' : ''}${route.savedTimePct.toStringAsFixed(0)}%',
        Icons.bolt_outlined,
        t.warning,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: metrics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.45,
      ),
      itemBuilder: (context, index) {
        final (label, value, icon, color) = metrics[index];
        return _ImpactMetric(
          label: label,
          value: value,
          icon: icon,
          color: color,
        );
      },
    );
  }
}

class _ImpactMetric extends StatelessWidget {
  const _ImpactMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, size: 18, color: color),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, color: t.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DailyProgress extends StatelessWidget {
  const _DailyProgress({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final scheme = Theme.of(context).colorScheme;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.today_outlined, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.resultsDailyProductivity,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '${(route.completionRatio * 100).round()}%',
                style: TextStyle(
                  color: scheme.primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            l10n.resultsDeliveriesCompleted(
              route.completedStops,
              route.totalStops,
            ),
            style: TextStyle(fontSize: 12, color: t.muted),
          ),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: route.completionRatio,
              minHeight: 7,
              backgroundColor: scheme.onSurface.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation(scheme.primary),
            ),
          ),
        ],
      ),
    );
  }
}

String _duration(double minutes) {
  final total = minutes.round();
  final hours = total ~/ 60;
  final rest = total % 60;
  return hours > 0 ? '${hours}h ${rest}min' : '${rest}min';
}
