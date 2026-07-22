import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/finance_models.dart';
import '../domain/history_models.dart';
import '../domain/insights_models.dart';
import 'add_finance_entry_sheet.dart';
import 'finance_cubit.dart';
import 'finance_labels.dart';

/// Tela de finanças do motorista (FASE 3, F1b): KPIs (custo/km, lucro/entrega),
/// totais do período e lançamentos, com adicionar/excluir.
class FinancePage extends StatelessWidget {
  const FinancePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<FinanceCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(leading: const NavLeading(), title: Text(l10n.finTitle)),
        body: BlocConsumer<FinanceCubit, FinanceState>(
          listenWhen: (p, c) => p.error != c.error && c.error != null,
          listener: (context, state) => ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(state.error!))),
          builder: (context, state) {
            return switch (state.status) {
              FinanceStatus.loading => const Center(child: CircularProgressIndicator()),
              FinanceStatus.error => NavixErrorState(
                  description: state.error ?? l10n.finLoadError,
                  onRetry: () => context.read<FinanceCubit>().load(),
                ),
              FinanceStatus.ready => _Content(state: state),
            };
          },
        ),
        floatingActionButton: BlocBuilder<FinanceCubit, FinanceState>(
          builder: (context, state) => FloatingActionButton.extended(
            heroTag: 'fab-finance',
            onPressed: state.busy ? null : () => _add(context),
            icon: const Icon(Icons.add),
            label: Text(l10n.finAddTitle),
          ),
        ),
      ),
    );
  }

  Future<void> _add(BuildContext context) async {
    final cubit = context.read<FinanceCubit>();
    final entry = await showAddFinanceEntrySheet(context);
    if (entry != null) await cubit.addEntry(entry);
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state});
  final FinanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final s = state.summary;
    return RefreshIndicator(
      onRefresh: () => context.read<FinanceCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          Row(children: [
            Expanded(child: _Kpi(label: l10n.finCostPerKm, value: s.costPerKm == null ? '—' : '€ ${s.costPerKm!.toStringAsFixed(2)}', suffix: '/km', icon: Icons.local_gas_station_outlined)),
            const SizedBox(width: 12),
            Expanded(child: _Kpi(label: l10n.finProfitPerDelivery, value: s.profitPerDelivery == null ? '—' : '€ ${s.profitPerDelivery!.toStringAsFixed(2)}', icon: Icons.trending_up)),
          ]),
          const SizedBox(height: 12),
          _Totals(summary: s),
          const SizedBox(height: 12),
          if (state.history.hasData) ...[
            NavixSectionHeader(title: l10n.finHistory, icon: Icons.show_chart),
            _HistoryCard(history: state.history),
            const SizedBox(height: 12),
          ],
          if (state.insights.hasData) ...[
            NavixSectionHeader(title: l10n.finInsights, icon: Icons.insights_outlined),
            _InsightsCard(insights: state.insights),
            const SizedBox(height: 12),
          ],
          NavixSectionHeader(title: l10n.finEntries, icon: Icons.receipt_long_outlined),
          if (state.entries.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(l10n.finNoEntries, textAlign: TextAlign.center, style: TextStyle(color: context.tokens.muted)),
            )
          else
            ...state.entries.map((e) => _EntryTile(entry: e)),
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value, required this.icon, this.suffix});
  final String label;
  final String value;
  final IconData icon;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 16, color: t.accent),
            const SizedBox(width: 6),
            Expanded(child: Text(label, style: TextStyle(fontSize: 11.5, color: t.muted))),
          ]),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
              if (suffix != null) Text(suffix!, style: TextStyle(fontSize: 11.5, color: t.muted)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.summary});
  final FinancialSummary summary;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    Widget cell(String label, double value, Color color) => Expanded(
          child: Column(children: [
            Text('€ ${value.toStringAsFixed(2)}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: t.muted)),
          ]),
        );
    return NavixCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      child: Row(children: [
        cell(l10n.finIncome, summary.totalIncome, t.success),
        cell(l10n.finExpense, summary.totalExpense, t.danger),
        cell(l10n.finBalance, summary.balance, summary.balance >= 0 ? t.success : t.danger),
      ]),
    );
  }
}

/// Histórico financeiro (F3): receita (verde) e despesa (vermelho) por período,
/// em barras, com legenda. Mostra os últimos períodos.
class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.history});
  final FinancialHistory history;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    // Últimos 8 períodos (o backend já devolve ordenado do mais antigo ao recente).
    final points = history.points.length > 8
        ? history.points.sublist(history.points.length - 8)
        : history.points;
    final max = points.fold<double>(
      0,
      (m, p) => [m, p.income, p.expense].reduce((a, b) => a > b ? a : b),
    );
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 96,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: points.map((p) => Expanded(child: _PeriodBars(point: p, max: max, income: t.success, expense: t.danger, track: t.surfaceAlt))).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            _LegendDot(color: t.success, label: l10n.finIncome),
            const SizedBox(width: 16),
            _LegendDot(color: t.danger, label: l10n.finExpense),
          ]),
        ],
      ),
    );
  }
}

class _PeriodBars extends StatelessWidget {
  const _PeriodBars({required this.point, required this.max, required this.income, required this.expense, required this.track});
  final FinancialHistoryPoint point;
  final double max;
  final Color income;
  final Color expense;
  final Color track;

  double _h(double v) => max <= 0 ? 4 : (4 + (v / max) * 64).clamp(4, 68).toDouble();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // Rótulo curto: 'MM' do mês ou 'dd/MM' da semana.
    final parts = point.period.split('-');
    final label = parts.length >= 3 ? '${parts[2]}/${parts[1]}' : (parts.length == 2 ? parts[1] : point.period);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _Bar(height: _h(point.income), color: income),
              const SizedBox(width: 2),
              _Bar(height: _h(point.expense), color: expense),
            ],
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 9, color: t.muted)),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.height, required this.color});
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(width: 7, height: height, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)));
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 5),
      Text(label, style: TextStyle(fontSize: 11, color: t.muted)),
    ]);
  }
}

/// Insights de padrão de entrega (F2): melhor região, melhor horário e um
/// mini-gráfico de barras das 24 horas.
class _InsightsCard extends StatelessWidget {
  const _InsightsCard({required this.insights});
  final DeliveryInsights insights;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: _InsightMetric(
              icon: Icons.place_outlined,
              label: l10n.finBestRegion,
              value: insights.bestRegion ?? '—',
            )),
            const SizedBox(width: 8),
            Expanded(child: _InsightMetric(
              icon: Icons.schedule,
              label: l10n.finBestHour,
              value: insights.bestHour == null ? '—' : '${insights.bestHour}h',
            )),
          ]),
          if (insights.byHour.isNotEmpty) ...[
            const SizedBox(height: 14),
            SizedBox(height: 56, child: _HourBars(byHour: insights.byHour, color: t.accent, track: t.surfaceAlt)),
            const SizedBox(height: 4),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('0h', style: TextStyle(fontSize: 10, color: t.muted)),
              Text('12h', style: TextStyle(fontSize: 10, color: t.muted)),
              Text('23h', style: TextStyle(fontSize: 10, color: t.muted)),
            ]),
          ],
        ],
      ),
    );
  }
}

class _InsightMetric extends StatelessWidget {
  const _InsightMetric({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 15, color: t.accent),
          const SizedBox(width: 6),
          Expanded(child: Text(label, style: TextStyle(fontSize: 11, color: t.muted))),
        ]),
        const SizedBox(height: 4),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

/// 24 barras (uma por hora), altura proporcional ao volume. A hora de pico
/// aparece destacada.
class _HourBars extends StatelessWidget {
  const _HourBars({required this.byHour, required this.color, required this.track});
  final List<HourStat> byHour;
  final Color color;
  final Color track;

  @override
  Widget build(BuildContext context) {
    final counts = List<int>.filled(24, 0);
    for (final h in byHour) {
      if (h.hour >= 0 && h.hour < 24) counts[h.hour] = h.deliveries;
    }
    final max = counts.fold<int>(0, (a, b) => b > a ? b : a);
    return LayoutBuilder(
      builder: (context, c) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(24, (h) {
            final frac = max == 0 ? 0.0 : counts[h] / max;
            final peak = counts[h] == max && max > 0;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1),
                child: Container(
                  height: (4 + frac * 48).clamp(4, 52).toDouble(),
                  decoration: BoxDecoration(
                    color: counts[h] == 0 ? track : (peak ? color : color.withValues(alpha: 0.55)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.entry});
  final FinancialEntry entry;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final color = entry.isIncome ? t.success : t.danger;
    final sign = entry.isIncome ? '+' : '−';
    final meta = <String>[
      entry.occurredAt,
      if (entry.liters != null) '${entry.liters!.toStringAsFixed(1)} L',
      if (entry.odometerKm != null) '${entry.odometerKm} km',
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(financeCategoryLabel(l10n, entry.category), style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(meta.join(' · '), style: TextStyle(fontSize: 12, color: t.muted)),
                ],
              ),
            ),
            Text('$sign € ${entry.amount.toStringAsFixed(2)}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: color)),
            IconButton(
              tooltip: l10n.finDelete,
              onPressed: () => context.read<FinanceCubit>().deleteEntry(entry.id),
              icon: Icon(Icons.delete_outline, size: 20, color: t.muted),
            ),
          ],
        ),
      ),
    );
  }
}
