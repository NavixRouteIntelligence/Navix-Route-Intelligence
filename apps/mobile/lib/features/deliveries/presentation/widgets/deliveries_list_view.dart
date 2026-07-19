import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../app/theme/navix_tokens.dart';
import '../../../../core/ui/navix_card.dart';
import '../../../../core/ui/navix_skeleton.dart';
import '../../../../core/ui/navix_states.dart';
import '../../../../core/ui/navix_status_pill.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../domain/delivery_summary.dart';
import '../deliveries_cubit.dart';

/// Corpo compartilhado da lista de entregas (Empresa e Motorista). Assume um
/// [DeliveriesCubit] provido acima. As telas concretas só fornecem a casca
/// (Scaffold/AppBar) — a diferença entre os perfis é a casca, não a lista, então
/// o conteúdo mora aqui para não duplicar (S1 / nota de arquitetura da sprint).
class DeliveriesListView extends StatelessWidget {
  const DeliveriesListView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _FilterBar(),
        Expanded(child: _Body()),
      ],
    );
  }
}

/// Rótulos dos filtros a partir do l10n (o valor `null` = todas).
List<(String, String?)> _filters(AppLocalizations l10n) => [
      (l10n.deliveriesFilterAll, null),
      (l10n.deliveryStatusPending, 'pending'),
      (l10n.deliveryStatusInRoute, 'in_route'),
      (l10n.deliveryStatusDelivered, 'delivered'),
      (l10n.deliveryStatusFailed, 'failed'),
    ];

class _FilterBar extends StatelessWidget {
  const _FilterBar();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filters = _filters(l10n);
    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      buildWhen: (p, c) => p.filter != c.filter,
      builder: (context, state) {
        return SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final (label, value) = filters[i];
              return ChoiceChip(
                label: Text(label),
                selected: state.filter == value,
                onSelected: (_) => context.read<DeliveriesCubit>().setFilter(value),
              );
            },
          ),
        );
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      builder: (context, state) {
        switch (state.status) {
          case DeliveriesStatus.loading:
            return const _LoadingList();
          case DeliveriesStatus.error:
            return NavixErrorState(
              title: l10n.deliveriesErrorTitle,
              description: state.error ?? l10n.deliveriesRetry,
              retryLabel: l10n.deliveriesRetry,
              onRetry: () => context.read<DeliveriesCubit>().load(),
            );
          case DeliveriesStatus.success:
            if (state.items.isEmpty) {
              return RefreshIndicator(
                onRefresh: () => context.read<DeliveriesCubit>().load(),
                child: ListView(
                  children: [
                    const SizedBox(height: 120),
                    NavixEmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: l10n.deliveriesEmptyTitle,
                      description: l10n.deliveriesEmptyDescription,
                    ),
                  ],
                ),
              );
            }
            return RefreshIndicator(
              onRefresh: () => context.read<DeliveriesCubit>().load(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                itemCount: state.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _DeliveryTile(state.items[i]),
              ),
            );
        }
      },
    );
  }
}

class _DeliveryTile extends StatelessWidget {
  const _DeliveryTile(this.delivery);

  final DeliverySummary delivery;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final (statusLabel, statusColor) = _statusStyle(delivery.status, t, l10n);
    final address = delivery.addressLine.isEmpty ? delivery.city : delivery.addressLine;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  address.isEmpty ? l10n.deliveriesNoAddress : address,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              NavixStatusPill(label: statusLabel, color: statusColor),
            ],
          ),
          if (delivery.city.isNotEmpty && delivery.addressLine.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(delivery.city, style: TextStyle(color: t.muted, fontSize: 13)),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.schedule_outlined, size: 15, color: t.muted),
              const SizedBox(width: 4),
              Text(_window(delivery, l10n), style: TextStyle(color: t.muted, fontSize: 13)),
              const Spacer(),
              if (delivery.priority == DeliveryPriorityView.high ||
                  delivery.priority == DeliveryPriorityView.urgent)
                _PriorityTag(delivery.priority, t, l10n),
            ],
          ),
        ],
      ),
    );
  }

  String _window(DeliverySummary d, AppLocalizations l10n) {
    final s = d.windowStart;
    final e = d.windowEnd;
    if (s == null || e == null) return l10n.deliveriesNoWindow;
    String hm(DateTime dt) =>
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    return '${hm(s)}–${hm(e)}';
  }

  (String, Color) _statusStyle(DeliveryStatusView s, NavixTokens t, AppLocalizations l10n) =>
      switch (s) {
        DeliveryStatusView.pending => (l10n.deliveryStatusPending, t.warning),
        DeliveryStatusView.inRoute => (l10n.deliveryStatusInRoute, t.accent),
        DeliveryStatusView.delivered => (l10n.deliveryStatusDelivered, t.success),
        DeliveryStatusView.failed => (l10n.deliveryStatusFailed, t.danger),
        DeliveryStatusView.unknown => ('—', t.muted),
      };
}

class _PriorityTag extends StatelessWidget {
  const _PriorityTag(this.priority, this.tokens, this.l10n);

  final DeliveryPriorityView priority;
  final NavixTokens tokens;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final urgent = priority == DeliveryPriorityView.urgent;
    final color = urgent ? tokens.danger : tokens.warning;
    final label = urgent ? l10n.deliveryPriorityUrgent : l10n.deliveryPriorityHigh;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.priority_high, size: 15, color: color, semanticLabel: label),
        Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _LoadingList extends StatelessWidget {
  const _LoadingList();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => const NavixCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NavixSkeleton(height: 16, width: 180),
            SizedBox(height: 10),
            NavixSkeleton(height: 12, width: 120),
          ],
        ),
      ),
    );
  }
}
