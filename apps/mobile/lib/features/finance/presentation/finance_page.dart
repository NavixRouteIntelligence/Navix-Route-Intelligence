import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/finance_models.dart';
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
        appBar: AppBar(title: Text(l10n.finTitle)),
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
