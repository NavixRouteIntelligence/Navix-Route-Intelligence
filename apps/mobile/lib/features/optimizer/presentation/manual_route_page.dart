import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/error/failure_l10n.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/editable_stop.dart';
import 'manual_route_cubit.dart';

/// Tela de **ordem manual** do Motorista (RSE-2b): arrasta para reordenar, trava
/// posições (cadeado) e escolhe entre salvar a ordem exata ou reotimizar
/// respeitando as travas. Fecha devolvendo `true` quando a rota é salva.
class ManualRoutePage extends StatelessWidget {
  const ManualRoutePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<ManualRouteCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.manualRouteTitle)),
        body: BlocConsumer<ManualRouteCubit, ManualRouteState>(
          listenWhen: (p, c) =>
              (c.status == ManualRouteStatus.success) || (p.error != c.error && c.error != null),
          listener: (context, state) {
            if (state.status == ManualRouteStatus.success) {
              Navigator.of(context).pop(true);
            } else if (state.error != null) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(content: Text(context.failureText(state.error!))));
            }
          },
          builder: (context, state) {
            return switch (state.status) {
              ManualRouteStatus.loading => const Center(child: CircularProgressIndicator()),
              ManualRouteStatus.error => NavixErrorState(
                  description: state.error == null ? l10n.manualRouteLoadError : context.failureText(state.error!),
                  onRetry: () => context.read<ManualRouteCubit>().load(),
                ),
              _ => state.stops.length < 2
                  ? NavixEmptyState(
                      icon: Icons.alt_route_outlined,
                      title: l10n.manualRouteEmptyTitle,
                      description: l10n.manualRouteEmptyDescription,
                    )
                  : _Editor(state: state),
            };
          },
        ),
      ),
    );
  }
}

class _Editor extends StatelessWidget {
  const _Editor({required this.state});
  final ManualRouteState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ManualRouteCubit>();
    final busy = state.status == ManualRouteStatus.submitting;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  l10n.manualRouteHint,
                  style: TextStyle(fontSize: 12.5, color: context.tokens.muted),
                ),
              ),
              if (state.lockedCount > 0)
                NavixStatusPill(
                  label: l10n.manualRouteLockedCount(state.lockedCount),
                  color: context.tokens.accent,
                ),
            ],
          ),
        ),
        Expanded(
          child: AbsorbPointer(
            absorbing: busy,
            child: ReorderableListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              itemCount: state.stops.length,
              onReorderItem: cubit.reorder,
              itemBuilder: (context, i) {
                final stop = state.stops[i];
                return _StopTile(
                  key: ValueKey(stop.id),
                  index: i,
                  stop: stop,
                  onToggleLock: () => cubit.toggleLock(stop.id),
                );
              },
            ),
          ),
        ),
        _ActionBar(busy: busy),
      ],
    );
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({
    required super.key,
    required this.index,
    required this.stop,
    required this.onToggleLock,
  });

  final int index;
  final EditableStop stop;
  final VoidCallback onToggleLock;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: stop.locked ? t.accent : Theme.of(context).colorScheme.primary,
              child: Text('${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stop.label.isEmpty ? stop.cityLine : stop.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                  ),
                  if (stop.cityLine.isNotEmpty && stop.label.isNotEmpty)
                    Text(stop.cityLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.muted)),
                ],
              ),
            ),
            IconButton(
              tooltip: stop.locked ? l10n.manualRouteUnlock : l10n.manualRouteLock,
              onPressed: onToggleLock,
              icon: Icon(
                stop.locked ? Icons.lock : Icons.lock_open_outlined,
                size: 20,
                color: stop.locked ? t.accent : t.muted,
              ),
            ),
            ReorderableDragStartListener(
              index: index,
              child: Icon(Icons.drag_handle, color: t.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.busy});
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ManualRouteCubit>();
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(top: BorderSide(color: t.line)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy ? null : cubit.reoptimizeRespectingLocks,
                icon: const Icon(Icons.auto_awesome_outlined, size: 18),
                label: Text(l10n.manualRouteReoptimize),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: busy ? null : cubit.saveManualOrder,
                icon: busy
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check, size: 18),
                label: Text(l10n.manualRouteSave),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
