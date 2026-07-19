import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../domain/delivery_summary.dart';
import 'deliveries_cubit.dart';

/// Lista de entregas da Empresa (aba "Entregas" do CompanyShell). Reusa a API
/// `GET /deliveries` e os componentes do design system. Filtro por status +
/// pull-to-refresh.
class CompanyDeliveriesPage extends StatelessWidget {
  const CompanyDeliveriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<DeliveriesCubit>()..load(),
      child: const _DeliveriesView(),
    );
  }
}

/// Filtros (rótulo → valor de status da API; `null` = todas).
const _filters = <(String, String?)>[
  ('Todas', null),
  ('Pendentes', 'pending'),
  ('Em rota', 'in_route'),
  ('Entregues', 'delivered'),
  ('Falhas', 'failed'),
];

class _DeliveriesView extends StatelessWidget {
  const _DeliveriesView();

  @override
  Widget build(BuildContext context) {
    final theme = GetIt.instance<ThemeCubit>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Entregas'),
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
      body: Column(
        children: [
          _FilterBar(),
          const Expanded(child: _Body()),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      buildWhen: (p, c) => p.filter != c.filter,
      builder: (context, state) {
        return SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: _filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final (label, value) = _filters[i];
              final selected = state.filter == value;
              return ChoiceChip(
                label: Text(label),
                selected: selected,
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
    return BlocBuilder<DeliveriesCubit, DeliveriesState>(
      builder: (context, state) {
        switch (state.status) {
          case DeliveriesStatus.loading:
            return const _LoadingList();
          case DeliveriesStatus.error:
            return NavixErrorState(
              title: 'Não foi possível carregar',
              description: state.error ?? 'Tente novamente.',
              onRetry: () => context.read<DeliveriesCubit>().load(),
            );
          case DeliveriesStatus.success:
            if (state.items.isEmpty) {
              return RefreshIndicator(
                onRefresh: () => context.read<DeliveriesCubit>().load(),
                child: ListView(
                  children: const [
                    SizedBox(height: 120),
                    NavixEmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: 'Sem entregas',
                      description: 'Nenhuma entrega para este filtro.',
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
    final (statusLabel, statusColor) = _statusStyle(delivery.status, t);
    final address = delivery.addressLine.isEmpty ? delivery.city : delivery.addressLine;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  address.isEmpty ? 'Endereço não informado' : address,
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
              Text(_window(delivery), style: TextStyle(color: t.muted, fontSize: 13)),
              const Spacer(),
              if (delivery.priority == DeliveryPriorityView.high ||
                  delivery.priority == DeliveryPriorityView.urgent)
                _PriorityTag(delivery.priority, t),
            ],
          ),
        ],
      ),
    );
  }

  String _window(DeliverySummary d) {
    final s = d.windowStart;
    final e = d.windowEnd;
    if (s == null || e == null) return 'Sem janela';
    String hm(DateTime dt) => '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    return '${hm(s)}–${hm(e)}';
  }

  (String, Color) _statusStyle(DeliveryStatusView s, NavixTokens t) => switch (s) {
        DeliveryStatusView.pending => ('Pendente', t.warning),
        DeliveryStatusView.inRoute => ('Em rota', t.accent),
        DeliveryStatusView.delivered => ('Entregue', t.success),
        DeliveryStatusView.failed => ('Falhou', t.danger),
        DeliveryStatusView.unknown => ('—', t.muted),
      };
}

class _PriorityTag extends StatelessWidget {
  const _PriorityTag(this.priority, this.tokens);

  final DeliveryPriorityView priority;
  final NavixTokens tokens;

  @override
  Widget build(BuildContext context) {
    final urgent = priority == DeliveryPriorityView.urgent;
    final color = urgent ? tokens.danger : tokens.warning;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.priority_high, size: 15, color: color),
        Text(
          urgent ? 'Urgente' : 'Alta',
          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
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
