import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/my_route.dart';
import 'my_route_cubit.dart';

/// Detalhe de uma paragem, aberto ao tocar no pino do mapa.
///
/// Uma folha e não uma tela: o mapa continua visível por trás, e fechar é um
/// gesto. Quem toca num pino quer saber o que é aquilo sem perder o sítio onde
/// estava a olhar.
Future<void> showStopDetailsSheet(
  BuildContext context, {
  required RouteStopInfo stop,
  required bool isNext,
}) {
  final cubit = context.read<MyRouteCubit>();
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => BlocProvider.value(
      value: cubit,
      child: _StopDetails(stop: stop, isNext: isNext),
    ),
  );
}

/// Rótulo do estado da entrega.
///
/// Um estado que o backend acrescente e a app não conheça cai no genérico «por
/// fazer» em vez de mostrar a chave crua — `in_transit` no ecrã não diz nada a
/// quem conduz.
String statusLabel(AppLocalizations l10n, String status,
    {bool isNext = false}) {
  if (isNext) return l10n.routeStopStatusNext;
  return switch (status) {
    'delivered' => l10n.routeStopStatusDelivered,
    'failed' => l10n.routeStopStatusFailed,
    'in_transit' => l10n.routeStopStatusInTransit,
    _ => l10n.routeStopStatusPending,
  };
}

/// Rótulo da prioridade. Desconhecida lê-se como normal — a alternativa seria
/// inventar urgência que ninguém declarou.
String priorityLabel(AppLocalizations l10n, String priority) =>
    switch (priority) {
      'low' => l10n.routeStopPriorityLow,
      'high' => l10n.routeStopPriorityHigh,
      'urgent' => l10n.routeStopPriorityUrgent,
      _ => l10n.routeStopPriorityNormal,
    };

class _StopDetails extends StatelessWidget {
  const _StopDetails({required this.stop, required this.isNext});

  final RouteStopInfo stop;
  final bool isNext;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final morada = stop.addressLine.isNotEmpty
        ? stop.addressLine
        : (stop.cityLine.isNotEmpty ? stop.cityLine : l10n.routeStopNoAddress);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: t.line,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.routeStopSheetTitle(stop.sequence),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(morada, style: TextStyle(color: t.muted)),
          const SizedBox(height: 16),
          _Linha(
            label: l10n.routeStopStatusLabel,
            value: statusLabel(l10n, stop.status, isNext: isNext),
          ),
          _Linha(
            label: l10n.routeStopPriorityLabel,
            value: priorityLabel(l10n, stop.priority),
          ),
          _Linha(
            label: l10n.routeStopEtaLabel,
            value: l10n.routeStopEta(stop.etaMinutes.round()),
          ),
          const SizedBox(height: 20),
          if (stop.hasNavigableCoordinates)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.navigation_outlined),
                label: Text(l10n.routeNavigate),
                onPressed: () => _navegar(context),
              ),
            )
          else
            // Sem coordenada não há para onde navegar. Um botão que abre o mapa
            // no sítio errado é pior do que um botão ausente.
            Text(
              l10n.routeStopNavigateUnavailable,
              style: TextStyle(color: t.muted),
            ),
        ],
      ),
    );
  }

  Future<void> _navegar(BuildContext context) async {
    final cubit = context.read<MyRouteCubit>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final l10n = AppLocalizations.of(context);

    final aberto = await cubit.navigateToStop(stop.deliveryId);
    if (!context.mounted) return;
    navigator.pop();
    if (!aberto) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.routeStopNavigateUnavailable)),
      );
    }
  }
}

class _Linha extends StatelessWidget {
  const _Linha({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: context.tokens.muted)),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
}
