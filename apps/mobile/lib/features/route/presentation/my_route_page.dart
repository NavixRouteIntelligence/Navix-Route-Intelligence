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
import '../../intelligence/presentation/voice_assistant_button.dart';
import '../../intelligence/presentation/voice_assistant_cubit.dart';
import '../../pod/presentation/pod_capture_sheet.dart';
import '../../pod/presentation/pod_sync_cubit.dart';
import '../domain/my_route.dart';
import 'destination_labels.dart';
import 'my_route_cubit.dart';

/// **Minha Rota** (ADR-0076): a rota que a IA já preparou, e o posto operacional
/// do motorista.
///
/// Não há botão "Otimizar" — desde a ADR-0074 a preparação acontece sozinha na
/// confirmação da importação. Além do resumo, dos fatores da IA e dos Grupos
/// Inteligentes, concentra as ações de operação (registrar entrega, voz) que
/// antes viviam numa tela de dashboard separada.
class MyRoutePage extends StatelessWidget {
  const MyRoutePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => GetIt.instance<MyRouteCubit>()..load()),
        BlocProvider(create: (_) => GetIt.instance<VoiceAssistantCubit>()),
        // Singleton: vive enquanto o app vive; não é fechado aqui.
        BlocProvider.value(value: GetIt.instance<PodSyncCubit>()),
      ],
      child: Scaffold(
        appBar: AppBar(leading: const NavLeading(), title: Text(l10n.navRoute)),
        floatingActionButton: const VoiceAssistantButton(),
        body: BlocBuilder<MyRouteCubit, MyRouteState>(
          builder: (context, state) => switch (state.status) {
            MyRouteLoadStatus.loading => const Center(child: CircularProgressIndicator()),
            MyRouteLoadStatus.error => NavixErrorState(
                description: state.error == null ? l10n.routeLoadError : context.failureText(state.error!),
                onRetry: () => context.read<MyRouteCubit>().load(),
              ),
            MyRouteLoadStatus.ready => _Content(state: state),
          },
        ),
        bottomNavigationBar: BlocBuilder<MyRouteCubit, MyRouteState>(
          buildWhen: (p, c) => p.route.next != c.route.next || p.status != c.status,
          builder: (context, state) => _RegisterBar(next: state.route.next),
        ),
      ),
    );
  }
}

/// Barra de ação operacional: registrar a próxima entrega (POD). Fica desativada
/// quando não há entrega pendente — rota concluída ou ainda a preparar.
class _RegisterBar extends StatelessWidget {
  const _RegisterBar({required this.next});
  final NextDelivery? next;

  Future<void> _register(BuildContext context) async {
    final target = next;
    if (target == null) return;
    final cubit = context.read<MyRouteCubit>();
    final registered = await showPodCaptureSheet(
      context,
      deliveryId: target.id,
      deliveryLabel: target.label.isEmpty ? null : target.label,
    );
    if (registered == true && context.mounted) {
      // A entrega registrada dispara reotimização no backend (ADR-0023): recarrega
      // para refletir o novo plano e a próxima parada.
      GetIt.instance<PodSyncCubit>().refresh();
      await cubit.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: next == null ? null : () => _register(context),
          icon: const Icon(Icons.camera_alt_outlined),
          label: Text(next == null ? l10n.routeNoPending : l10n.routeRegisterDelivery),
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state});
  final MyRouteState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final route = state.route;

    if (!route.isReady) {
      return RefreshIndicator(
        onRefresh: () => context.read<MyRouteCubit>().load(),
        child: ListView(
          children: [
            SizedBox(height: MediaQuery.sizeOf(context).height * 0.18),
            NavixEmptyState(
              icon: route.status == MyRouteStatus.preparing ? Icons.auto_awesome : Icons.route_outlined,
              title: route.status == MyRouteStatus.preparing ? l10n.routePreparingTitle : l10n.routeEmptyTitle,
              description:
                  route.status == MyRouteStatus.preparing ? l10n.routePreparingDesc : l10n.routeEmptyDesc,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<MyRouteCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _Summary(route: route),
          const SizedBox(height: 12),
          const _AiPanel(),
          const SizedBox(height: 12),
          NavixSectionHeader(title: l10n.routeGroups, icon: Icons.category_outlined),
          ...route.groups.map((g) => _GroupTile(
                group: g,
                route: route,
                expanded: state.expanded.contains(g.type),
              )),
        ],
      ),
    );
  }
}

/// Resumo da rota: o que o motorista precisa saber antes de sair.
class _Summary extends StatelessWidget {
  const _Summary({required this.route});
  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(l10n.routeReadyByAi,
                    style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
              ),
              _StatusChip(label: l10n.routeStatusReady, color: t.success),
            ],
          ),
          const SizedBox(height: 14),
          Row(children: [
            _Metric(value: '${route.totalStops}', label: l10n.routeStops, icon: Icons.pin_drop_outlined),
            _Metric(
                value: '${route.distanceKm.toStringAsFixed(1)} km',
                label: l10n.routeDistance,
                icon: Icons.straighten),
            _Metric(
                value: _duration(route.timeMinutes),
                label: l10n.routeTime,
                icon: Icons.schedule_outlined),
          ]),
          if (route.savedKm > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: t.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Icon(Icons.trending_down, size: 18, color: t.success),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n.routeSavings(
                      route.savedKm.toStringAsFixed(1),
                      route.savedPct.toStringAsFixed(0),
                    ),
                    style: TextStyle(fontSize: 12.5, color: t.success, fontWeight: FontWeight.w600),
                  ),
                ),
              ]),
            ),
          ],
          if (route.updatedAt != null) ...[
            const SizedBox(height: 10),
            Text(l10n.routeUpdatedAt(_time(route.updatedAt!)),
                style: TextStyle(fontSize: 11.5, color: t.muted)),
          ],
        ],
      ),
    );
  }

  static String _duration(double minutes) {
    final total = minutes.round();
    final h = total ~/ 60;
    final m = total % 60;
    return h > 0 ? '${h}h ${m}min' : '${m}min';
  }

  static String _time(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')} '
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label, required this.icon});
  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Expanded(
      child: Column(children: [
        Icon(icon, size: 16, color: t.muted),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: t.muted)),
      ]),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
      );
}

/// O que a IA levou em conta. Lista **só o que o motor usa de verdade** — não
/// há fonte de trânsito ao vivo no sistema, então o painel fala em padrões
/// históricos por região e horário (Inteligência Coletiva, ADR-0065) em vez de
/// prometer trânsito.
class _AiPanel extends StatelessWidget {
  const _AiPanel();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final factors = <(IconData, String)>[
      (Icons.straighten, l10n.factorDistance),
      (Icons.map_outlined, l10n.factorRegion),
      (Icons.insights_outlined, l10n.factorHistory),
      (Icons.category_outlined, l10n.factorDestinationType),
      (Icons.schedule_outlined, l10n.factorTimeWindow),
      (Icons.priority_high, l10n.factorPriority),
      (Icons.inventory_2_outlined, l10n.factorCapacity),
      (Icons.local_shipping_outlined, l10n.factorVehicle),
    ];

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.psychology_outlined, size: 18, color: t.accent),
            const SizedBox(width: 8),
            Text(l10n.routeAiTitle, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          Text(l10n.routeAiSubtitle, style: TextStyle(fontSize: 12, color: t.muted)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (icon, label) in factors)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: t.surfaceAlt,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: t.line),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icon, size: 13, color: t.muted),
                    const SizedBox(width: 6),
                    Text(label, style: const TextStyle(fontSize: 11.5)),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Um Grupo Inteligente, expansível. A ordem mostrada é a da rota — o grupo
/// **não** reordena nada (ADR-0075).
class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group, required this.route, required this.expanded});

  final RouteGroup group;
  final MyRoute route;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final stops = route.stopsOf(group);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => context.read<MyRouteCubit>().toggleGroup(group.type),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: t.accent.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(destinationIcon(group.type), size: 18, color: t.accent),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(destinationLabel(l10n, group.type),
                            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          '${l10n.routeGroupStops(group.stops)} · '
                          '${group.distanceKm.toStringAsFixed(1)} km · '
                          '${group.timeMinutes.round()} min',
                          style: TextStyle(fontSize: 12, color: t.muted),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: t.motionFast,
                    child: Icon(Icons.expand_more, color: t.muted),
                  ),
                ]),
              ),
            ),
            AnimatedCrossFade(
              duration: t.motionBase,
              crossFadeState: expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
              firstChild: const SizedBox(width: double.infinity),
              secondChild: Column(
                children: [
                  Divider(height: 1, color: t.line),
                  ...stops.map((s) => _StopTile(stop: s)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({required this.stop});
  final RouteStopInfo stop;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: Row(children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: t.surfaceAlt,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: t.line),
          ),
          child: Text('${stop.sequence}',
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(stop.addressLine.isEmpty ? '—' : stop.addressLine,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
              if (stop.cityLine.isNotEmpty)
                Text(stop.cityLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, color: t.muted)),
            ],
          ),
        ),
        Text('${stop.etaMinutes.round()} min', style: TextStyle(fontSize: 11.5, color: t.muted)),
      ]),
    );
  }
}
