import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/driver_tariff.dart';
import 'earnings_cubit.dart';
import 'tariff_sheet.dart';

/// Card de **ganhos previstos** (M3, opção A). Cruza a tarifa configurada com as
/// entregas e a distância da rota. Sem tarifa, convida a configurar. Tocar edita.
class EarningsCard extends StatelessWidget {
  const EarningsCard({super.key, required this.deliveries, required this.km});

  final int deliveries;
  final double km;

  Future<void> _edit(BuildContext context, DriverTariff current) async {
    final cubit = context.read<EarningsCubit>();
    final updated = await showTariffSheet(context, current);
    if (updated != null) {
      await cubit.save(perDelivery: updated.perDelivery, perKm: updated.perKm);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<EarningsCubit, EarningsState>(
      builder: (context, state) {
        if (!state.loaded) return const SizedBox.shrink();
        final tariff = state.tariff;
        final configured = tariff.isConfigured;
        final total = estimateEarnings(tariff, deliveries: deliveries, km: km);
        return NavixCard(
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => _edit(context, tariff),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: NavixSectionHeader(title: l10n.earningsTitle, icon: Icons.payments_outlined),
                    ),
                    Icon(Icons.edit_outlined, size: 16, color: t.muted),
                  ],
                ),
                if (!configured) ...[
                  Text(l10n.earningsSetupPrompt, style: TextStyle(fontSize: 13.5, color: t.muted, height: 1.35)),
                ] else ...[
                  Text(
                    '€ ${total.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.earningsBreakdown(deliveries, km.toStringAsFixed(1)),
                    style: TextStyle(fontSize: 12, color: t.muted),
                  ),
                  const SizedBox(height: 6),
                  Text(l10n.earningsEstimateNote, style: TextStyle(fontSize: 10.5, color: t.muted)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
