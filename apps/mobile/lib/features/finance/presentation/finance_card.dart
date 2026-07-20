import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../l10n/gen/app_localizations.dart';
import 'finance_cubit.dart';
import 'finance_page.dart';

/// Card compacto de finanças no painel do Motorista (FASE 3, F1b): custo/km e
/// lucro/entrega do período. Tocar abre a tela completa. Carrega só o resumo.
class FinanceCard extends StatelessWidget {
  const FinanceCard({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<FinanceCubit>()..loadSummary(),
      child: const _FinanceCardView(),
    );
  }
}

class _FinanceCardView extends StatelessWidget {
  const _FinanceCardView();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<FinanceCubit, FinanceState>(
      buildWhen: (p, c) => p.summary != c.summary || p.status != c.status,
      builder: (context, state) {
        final s = state.summary;
        final cost = s.costPerKm == null ? '—' : '€ ${s.costPerKm!.toStringAsFixed(2)}';
        final profit = s.profitPerDelivery == null ? '—' : '€ ${s.profitPerDelivery!.toStringAsFixed(2)}';
        return NavixCard(
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => Navigator.of(context).push<void>(
              MaterialPageRoute(builder: (_) => const FinancePage()),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: NavixSectionHeader(title: l10n.finTitle, icon: Icons.account_balance_wallet_outlined)),
                  Icon(Icons.chevron_right, size: 18, color: t.muted),
                ]),
                Row(children: [
                  Expanded(child: _Metric(label: l10n.finCostPerKm, value: cost, suffix: '/km')),
                  const SizedBox(width: 8),
                  Expanded(child: _Metric(label: l10n.finProfitPerDelivery, value: profit)),
                ]),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, this.suffix});
  final String label;
  final String value;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
            if (suffix != null) Text(suffix!, style: TextStyle(fontSize: 11, color: t.muted)),
          ],
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: t.muted)),
      ],
    );
  }
}
