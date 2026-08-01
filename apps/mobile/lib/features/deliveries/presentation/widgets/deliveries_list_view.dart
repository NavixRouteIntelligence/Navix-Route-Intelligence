import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/failure_l10n.dart';
import '../../../../app/theme/navix_tokens.dart';
import '../../../../core/ui/navix_card.dart';
import '../../../../core/ui/navix_section_header.dart';
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
  const DeliveriesListView({super.key, this.driverView = false});

  final bool driverView;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (driverView) const _DriverOverview(),
        _FilterBar(showCounts: driverView),
        Expanded(child: _Body(driverView: driverView)),
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
  const _FilterBar({required this.showCounts});

  final bool showCounts;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filters = _filters(l10n);
    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      buildWhen: (p, c) =>
          p.filter != c.filter || (showCounts && p.stats != c.stats),
      builder: (context, state) {
        return SizedBox(
          height: 56,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 28, 8),
            itemCount: filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final (label, value) = filters[i];
              return ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label),
                    if (showCounts) ...[
                      const SizedBox(width: 6),
                      Text(
                        '${state.stats.countFor(value)}',
                        style: TextStyle(
                          fontSize: 11,
                          color: state.filter == value
                              ? null
                              : context.tokens.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
                selected: state.filter == value,
                onSelected: (_) =>
                    context.read<DeliveriesCubit>().setFilter(value),
              );
            },
          ),
        );
      },
    );
  }
}

class _DriverOverview extends StatelessWidget {
  const _DriverOverview();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final scheme = Theme.of(context).colorScheme;

    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      buildWhen: (p, c) => p.stats != c.stats || p.status != c.status,
      builder: (context, state) {
        final stats = state.stats;
        final progress = stats.all == 0
            ? 0.0
            : (stats.delivered / stats.all).clamp(0.0, 1.0).toDouble();

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 10, 16, 2),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                scheme.primary.withValues(alpha: 0.22),
                t.accent.withValues(alpha: 0.07),
                scheme.surface,
              ],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: scheme.primary.withValues(alpha: 0.28),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: scheme.primary.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(
                      Icons.inventory_2_outlined,
                      size: 18,
                      color: scheme.primary,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.deliveriesTodaySummary,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          l10n.deliveriesSummaryTotal(stats.all),
                          style: TextStyle(fontSize: 12, color: t.muted),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${(progress * 100).round()}%',
                    style: TextStyle(
                      color: scheme.primary,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.deliveriesSummaryDelivered(stats.delivered),
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    l10n.deliveriesSummaryRemaining(stats.remaining),
                    style: TextStyle(fontSize: 12, color: t.muted),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: scheme.onSurface.withValues(alpha: 0.1),
                  valueColor: AlwaysStoppedAnimation(scheme.primary),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.driverView});

  final bool driverView;

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
              description: state.error == null
                  ? l10n.deliveriesRetry
                  : context.failureText(state.error!),
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
              child: driverView
                  ? _DriverDeliveryList(items: state.items)
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: state.items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) =>
                          _DeliveryTile(state.items[i]),
                    ),
            );
        }
      },
    );
  }
}

class _DriverDeliveryList extends StatelessWidget {
  const _DriverDeliveryList({required this.items});

  final List<DeliverySummary> items;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final priority = items
        .where(
          (item) =>
              (item.priority == DeliveryPriorityView.urgent ||
                  item.priority == DeliveryPriorityView.high) &&
              item.status != DeliveryStatusView.delivered &&
              item.status != DeliveryStatusView.failed,
        )
        .toList();
    final priorityIds = priority.map((item) => item.id).toSet();
    final others =
        items.where((item) => !priorityIds.contains(item.id)).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        if (priority.isNotEmpty) ...[
          NavixSectionHeader(
            title: l10n.deliveriesPriorityNow,
            icon: Icons.bolt_outlined,
          ),
          const SizedBox(height: 8),
          for (final item in priority) ...[
            _DriverDeliveryTile(item),
            const SizedBox(height: 10),
          ],
        ],
        if (others.isNotEmpty) ...[
          if (priority.isNotEmpty) ...[
            const SizedBox(height: 8),
            NavixSectionHeader(
              title: l10n.deliveriesOthers,
              icon: Icons.format_list_bulleted,
            ),
            const SizedBox(height: 8),
          ],
          for (var i = 0; i < others.length; i++) ...[
            _DriverDeliveryTile(others[i]),
            if (i != others.length - 1) const SizedBox(height: 10),
          ],
        ],
      ],
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
    final (statusLabel, statusColor) =
        _deliveryStatusStyle(delivery.status, t, l10n);
    final address =
        delivery.addressLine.isEmpty ? delivery.city : delivery.addressLine;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  address.isEmpty ? l10n.deliveriesNoAddress : address,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
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
              Text(
                _deliveryWindow(delivery, l10n),
                style: TextStyle(color: t.muted, fontSize: 13),
              ),
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
}

class _DriverDeliveryTile extends StatelessWidget {
  const _DriverDeliveryTile(this.delivery);

  final DeliverySummary delivery;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final (statusLabel, statusColor) =
        _deliveryStatusStyle(delivery.status, t, l10n);
    final address =
        delivery.addressLine.isEmpty ? delivery.city : delivery.addressLine;
    final priorityColor = switch (delivery.priority) {
      DeliveryPriorityView.urgent => t.danger,
      DeliveryPriorityView.high => t.warning,
      _ => Colors.transparent,
    };

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: priorityColor == Colors.transparent
              ? scheme.outlineVariant
              : priorityColor.withValues(alpha: 0.34),
        ),
        boxShadow: [
          if (priorityColor != Colors.transparent)
            BoxShadow(
              color: priorityColor.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (priorityColor != Colors.transparent)
              Container(width: 4, color: priorityColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            address.isEmpty
                                ? l10n.deliveriesNoAddress
                                : address,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        NavixStatusPill(
                          label: statusLabel,
                          color: statusColor,
                        ),
                      ],
                    ),
                    if (delivery.city.isNotEmpty &&
                        delivery.addressLine.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        delivery.city,
                        style: TextStyle(color: t.muted, fontSize: 12.5),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: t.surfaceAlt,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.schedule_outlined,
                            size: 15,
                            color: t.muted,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _deliveryDeadline(delivery, l10n),
                            style: TextStyle(color: t.muted, fontSize: 12.5),
                          ),
                        ),
                        if (delivery.priority == DeliveryPriorityView.high ||
                            delivery.priority == DeliveryPriorityView.urgent)
                          _PriorityTag(delivery.priority, t, l10n),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _deliveryWindow(DeliverySummary delivery, AppLocalizations l10n) {
  final start = delivery.windowStart;
  final end = delivery.windowEnd;
  if (start == null || end == null) return l10n.deliveriesNoWindow;
  return '${_hourMinute(start)}–${_hourMinute(end)}';
}

String _deliveryDeadline(DeliverySummary delivery, AppLocalizations l10n) {
  final end = delivery.windowEnd;
  if (end == null) return l10n.deliveriesNoWindow;
  return l10n.deliveriesDeliverBy(_hourMinute(end));
}

String _hourMinute(DateTime date) =>
    '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';

(String, Color) _deliveryStatusStyle(
  DeliveryStatusView status,
  NavixTokens tokens,
  AppLocalizations l10n,
) =>
    switch (status) {
      DeliveryStatusView.pending => (
          l10n.deliveryStatusPending,
          tokens.warning
        ),
      DeliveryStatusView.inRoute => (l10n.deliveryStatusInRoute, tokens.accent),
      DeliveryStatusView.delivered => (
          l10n.deliveryStatusDelivered,
          tokens.success
        ),
      DeliveryStatusView.failed => (l10n.deliveryStatusFailed, tokens.danger),
      DeliveryStatusView.unknown => ('—', tokens.muted),
    };

class _PriorityTag extends StatelessWidget {
  const _PriorityTag(this.priority, this.tokens, this.l10n);

  final DeliveryPriorityView priority;
  final NavixTokens tokens;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final urgent = priority == DeliveryPriorityView.urgent;
    final color = urgent ? tokens.danger : tokens.warning;
    final label =
        urgent ? l10n.deliveryPriorityUrgent : l10n.deliveryPriorityHigh;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.priority_high, size: 15, color: color, semanticLabel: label),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
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
