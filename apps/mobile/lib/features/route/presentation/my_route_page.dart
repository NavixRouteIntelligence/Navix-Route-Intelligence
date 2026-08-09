import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../core/session/session_cubit.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../intelligence/presentation/voice_assistant_button.dart';
import '../../intelligence/presentation/voice_assistant_cubit.dart';
import '../../kaizen/presentation/kaizen_daily_page.dart';
import '../../performance/presentation/driver_performance_card.dart';
import '../../pod/presentation/pod_capture_sheet.dart';
import '../../pod/presentation/pod_sync_cubit.dart';
import '../data/my_route_repository.dart';
import '../domain/my_route.dart';
import 'destination_labels.dart';
import 'my_route_cubit.dart';

/// **Minha Rota** (ADR-0076): resumo e sequência operacional do motorista.
///
/// Não há botão "Otimizar" — desde a ADR-0074 a preparação acontece sozinha na
/// confirmação da importação. A tela concentra as ações de operação (registrar
/// entrega, voz) que antes viviam numa tela de dashboard separada.
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
      child: _RouteLifecycle(
        child: Scaffold(
          appBar: AppBar(
            leading: const NavLeading(),
            title: Text(l10n.navRoute),
            actions: [
              // Ação SECUNDÁRIA (ADR-0078): reorganizar. A IA é o padrão; só aparece
              // quando há rota com paradas suficientes.
              BlocBuilder<MyRouteCubit, MyRouteState>(
                buildWhen: (p, c) =>
                    p.route.isReady != c.route.isReady ||
                    p.reorganizing != c.reorganizing,
                builder: (context, state) =>
                    state.route.isReady && state.route.stops.length >= 2
                        ? IconButton(
                            tooltip: l10n.routeReorganize,
                            icon: const Icon(Icons.tune),
                            onPressed: state.reorganizing
                                ? null
                                : () => _openReorganize(context, state.route),
                          )
                        : const SizedBox.shrink(),
              ),
            ],
          ),
          floatingActionButton: const VoiceAssistantButton(compact: true),
          body: BlocConsumer<MyRouteCubit, MyRouteState>(
            listenWhen: (p, c) => p.error != c.error && c.error != null,
            listener: (context, state) => ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(content: Text(context.failureText(state.error!))),
              ),
            builder: (context, state) {
              final body = switch (state.status) {
                MyRouteLoadStatus.loading => const Center(
                    child: CircularProgressIndicator(),
                  ),
                MyRouteLoadStatus.error => NavixErrorState(
                    description: state.error == null
                        ? l10n.routeLoadError
                        : context.failureText(state.error!),
                    onRetry: () => context.read<MyRouteCubit>().load(),
                  ),
                MyRouteLoadStatus.ready => _Content(state: state),
              };
              // Enquanto reorganiza, cobre a tela com um véu + progresso: a rota
              // atual continua atrás, sem sensação de "recomeçar do zero".
              return Stack(
                children: [
                  body,
                  if (state.reorganizing) _ReorganizingOverlay()
                ],
              );
            },
          ),
          bottomNavigationBar: BlocBuilder<MyRouteCubit, MyRouteState>(
            buildWhen: (p, c) =>
                p.route.next != c.route.next || p.status != c.status,
            builder: (context, state) => _RegisterBar(next: state.route.next),
          ),
        ),
      ),
    );
  }

  Future<void> _openReorganize(BuildContext context, MyRoute route) async {
    final cubit = context.read<MyRouteCubit>();
    final l10n = AppLocalizations.of(context);
    final order = route.stops.map((s) => s.deliveryId).toList();

    final mode = await showModalBottomSheet<ReorganizeMode>(
      context: context,
      showDragHandle: true,
      builder: (context) => _ReorganizeSheet(),
    );
    if (mode == null || !context.mounted) return;

    // IA: reordena sozinha, é só disparar. Manual: o motorista define a ordem
    // numa lista arrastável antes de confirmar.
    List<String> finalOrder = order;
    if (mode == ReorganizeMode.manual) {
      final reordered = await Navigator.of(context).push<List<String>>(
        MaterialPageRoute(
          builder: (_) => _ManualReorderPage(stops: route.stops),
        ),
      );
      if (reordered == null) return;
      finalOrder = reordered;
    }

    final ok = await cubit.reorganize(mode, finalOrder);
    if (ok && context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.routeReorganized)));
    }
  }
}

/// Observa apenas o retorno da navegação externa. A rota permanece montada e o
/// Cubit decide se há contexto pendente para atualizar.
class _RouteLifecycle extends StatefulWidget {
  const _RouteLifecycle({required this.child});

  final Widget child;

  @override
  State<_RouteLifecycle> createState() => _RouteLifecycleState();
}

class _RouteLifecycleState extends State<_RouteLifecycle>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      context.read<MyRouteCubit>().resumeFromNavigation();
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Véu de progresso durante a reorganização.
class _ReorganizingOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.45),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 14),
              Text(
                l10n.routeReorganizing,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Escolha do modo de reorganização. A IA é o padrão recomendado (ADR-0078).
class _ReorganizeSheet extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                l10n.routeReorganize,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          ListTile(
            leading: Icon(Icons.auto_awesome, color: t.accent),
            title: Text(l10n.routeReorgAi),
            subtitle: Text(
              l10n.routeReorgAiDesc,
              style: TextStyle(color: t.muted, fontSize: 12),
            ),
            trailing: _RecommendedPill(),
            onTap: () => Navigator.of(context).pop(ReorganizeMode.ai),
          ),
          ListTile(
            leading: const Icon(Icons.drag_handle),
            title: Text(l10n.routeReorgManual),
            subtitle: Text(
              l10n.routeReorgManualDesc,
              style: TextStyle(color: t.muted, fontSize: 12),
            ),
            onTap: () => Navigator.of(context).pop(ReorganizeMode.manual),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _RecommendedPill extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: t.accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        l10n.routeRecommended,
        style: TextStyle(
          color: t.accent,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Reordenação manual: o motorista arrasta as paradas; confirmar devolve a nova
/// ordem de deliveryIds. O backend a preserva (estratégia `manual`).
class _ManualReorderPage extends StatefulWidget {
  const _ManualReorderPage({required this.stops});
  final List<RouteStopInfo> stops;

  @override
  State<_ManualReorderPage> createState() => _ManualReorderPageState();
}

class _ManualReorderPageState extends State<_ManualReorderPage> {
  late final List<RouteStopInfo> _stops = List.of(widget.stops);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.routeReorgManual),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(
              context,
            ).pop(_stops.map((s) => s.deliveryId).toList()),
            child: Text(l10n.commonSave),
          ),
        ],
      ),
      body: ReorderableListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _stops.length,
        // ignore: deprecated_member_use  // onReorderItem é churn recente (>3.41); onReorder segue correto.
        onReorder: (oldIndex, newIndex) => setState(() {
          if (newIndex > oldIndex) newIndex -= 1;
          _stops.insert(newIndex, _stops.removeAt(oldIndex));
        }),
        itemBuilder: (context, i) {
          final s = _stops[i];
          return ListTile(
            key: ValueKey(s.deliveryId),
            leading: CircleAvatar(
              radius: 14,
              child: Text('${i + 1}', style: const TextStyle(fontSize: 12)),
            ),
            title: Text(
              s.addressLine.isEmpty ? '—' : s.addressLine,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: s.cityLine.isEmpty
                ? null
                : Text(
                    s.cityLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
            trailing: const Icon(Icons.drag_handle),
          );
        },
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
          label: Text(
            next == null ? l10n.routeNoPending : l10n.routeRegisterDelivery,
          ),
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
              icon: route.status == MyRouteStatus.preparing
                  ? Icons.auto_awesome
                  : Icons.route_outlined,
              title: route.status == MyRouteStatus.preparing
                  ? l10n.routePreparingTitle
                  : l10n.routeEmptyTitle,
              description: route.status == MyRouteStatus.preparing
                  ? l10n.routePreparingDesc
                  : l10n.routeEmptyDesc,
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
          _RouteHero(route: route),
          const SizedBox(height: 12),
          // Rota parcial (ADR-0110): acima de tudo, antes de o motorista sair.
          if (route.isPartial) ...[
            _PartialRouteWarning(unassigned: route.unassigned),
            const SizedBox(height: 12),
          ],
          _Summary(route: route),
          const SizedBox(height: 12),
          // Desempenho consolidado, meta e sequência (ADR-0097).
          const DriverPerformanceCard(),
          const SizedBox(height: 12),
          // Entrada para «O seu dia de ontem» (ADR-0120). Fica aqui, ao lado do
          // desempenho, e **não** na barra de navegação: o resumo é uma leitura
          // de manhã, não um destino que se visita ao longo do dia — e um
          // separador a mais empurraria a rota, que é o que o motorista usa.
          const _KaizenEntry(),
          const SizedBox(height: 20),
          NavixSectionHeader(
            title: l10n.routeDestinationTypes,
            icon: Icons.category_outlined,
          ),
          const SizedBox(height: 8),
          _DestinationOverview(groups: route.groups),
          const SizedBox(height: 20),
          NavixSectionHeader(
            title: l10n.routeDeliveryOrder,
            icon: Icons.format_list_numbered,
          ),
          const SizedBox(height: 8),
          _DeliveryOrder(route: route),
        ],
      ),
    );
  }
}

/// Aviso de rota parcial (ADR-0110).
///
/// Fica **acima** do resumo e da sequência, porque a pergunta que ele responde
/// — "estou levando tudo?" — precisa ser respondida antes de o motorista sair,
/// não depois de ele descobrir na doca.
///
/// `liveRegion` para que quem usa leitor de tela ouça sem procurar; `status` e
/// não `alert`, porque é informação a considerar, não emergência a interromper.
class _PartialRouteWarning extends StatelessWidget {
  const _PartialRouteWarning({required this.unassigned});

  final List<UnassignedStop> unassigned;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final titulo = l10n.routePartialTitle(unassigned.length);

    String motivo(String reason) => switch (reason) {
          'isolated' => l10n.routePartialIsolated,
          'disconnected' => l10n.routePartialDisconnected,
          _ => l10n.routePartialCapacity,
        };
    // Motivos distintos, sem repetir: três entregas que não cabem são um
    // motivo, não três linhas iguais.
    final motivos = {for (final u in unassigned) motivo(u.reason)}.join('; ');

    return Semantics(
      liveRegion: true,
      label: '\$titulo. \$motivos. \${l10n.routePartialHint}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.warning.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: t.warning.withValues(alpha: 0.35)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.warning_amber_rounded, size: 20, color: t.warning),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    titulo,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(motivos, style: TextStyle(fontSize: 12, color: t.muted)),
                  const SizedBox(height: 3),
                  Text(
                    l10n.routePartialHint,
                    style: TextStyle(fontSize: 11.5, color: t.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteHero extends StatelessWidget {
  const _RouteHero({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();
    final greeting = switch (now.hour) {
      < 12 => l10n.routeGreetingMorning,
      < 18 => l10n.routeGreetingAfternoon,
      _ => l10n.routeGreetingEvening,
    };
    final name = _displayName();
    final next = route.next;
    final nextEta = next == null ? null : _etaFor(next.id);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.3),
            t.accent.withValues(alpha: 0.1),
            scheme.surface,
          ],
          stops: const [0, 0.62, 1],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: scheme.primary.withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -30,
            top: -42,
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: t.accent.withValues(alpha: 0.07),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name == null ? greeting : '$greeting, $name',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 21,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            MaterialLocalizations.of(context)
                                .formatFullDate(now),
                            style: TextStyle(fontSize: 12.5, color: t.muted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: scheme.primary.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: scheme.primary.withValues(alpha: 0.28),
                        ),
                      ),
                      child: Icon(
                        Icons.navigation_rounded,
                        color: scheme.primary,
                        size: 20,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.routeProgressCount(
                          route.completedStops,
                          route.totalStops,
                        ),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      l10n.routeProgressRemaining(route.remainingStops),
                      style: TextStyle(fontSize: 12, color: t.muted),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: route.completionRatio),
                  duration: t.motionSlow,
                  builder: (context, value, _) => ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: value,
                      minHeight: 7,
                      backgroundColor: scheme.onSurface.withValues(alpha: 0.1),
                      valueColor: AlwaysStoppedAnimation(scheme.primary),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.surface.withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: t.line),
                  ),
                  child: next == null
                      ? Row(
                          children: [
                            Icon(
                              Icons.check_circle_outline,
                              color: t.success,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              l10n.routeAllDeliveriesDone,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: t.accent.withValues(alpha: 0.13),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                Icons.near_me_outlined,
                                size: 18,
                                color: t.accent,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l10n.routeNextStop,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      color: t.muted,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    next.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (nextEta != null) ...[
                              const SizedBox(width: 8),
                              Text(
                                '${nextEta.round()} min',
                                style: TextStyle(
                                  color: t.accent,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                            const SizedBox(width: 4),
                            IconButton(
                              key: const ValueKey('navigate-next-stop'),
                              tooltip: l10n.routeNavigate,
                              visualDensity: VisualDensity.compact,
                              icon: Icon(
                                Icons.navigation_rounded,
                                color: t.accent,
                                size: 20,
                              ),
                              onPressed: () => _navigate(context),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _displayName() {
    if (!GetIt.instance.isRegistered<SessionCubit>()) return null;
    final email = GetIt.instance<SessionCubit>().state.email;
    if (email == null || email.isEmpty) return null;
    final local =
        email.split('@').first.replaceAll(RegExp(r'[._-]+'), ' ').trim();
    if (local.isEmpty) return null;
    return local
        .split(' ')
        .map((word) => word.isEmpty
            ? word
            : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }

  double? _etaFor(String deliveryId) {
    for (final stop in route.stops) {
      if (stop.deliveryId == deliveryId) return stop.etaMinutes;
    }
    return null;
  }

  Future<void> _navigate(BuildContext context) async {
    final opened = await context.read<MyRouteCubit>().navigateToNext();
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content:
                Text(AppLocalizations.of(context).routeNavigationUnavailable),
          ),
        );
    }
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
              Icon(Icons.route_outlined, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.routeSummaryTitle,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _StatusChip(label: l10n.routeStatusReady, color: t.success),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _Metric(
                value: '${route.totalStops}',
                label: l10n.routeStops,
                icon: Icons.pin_drop_outlined,
              ),
              _Metric(
                value: '${route.distanceKm.toStringAsFixed(1)} km',
                label: l10n.routeDistance,
                icon: Icons.straighten,
              ),
              _Metric(
                value: _duration(route.timeMinutes),
                label: l10n.routeTime,
                icon: Icons.schedule_outlined,
              ),
            ],
          ),
          if (route.savedKm > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: t.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.trending_down, size: 18, color: t.success),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.routeSavings(
                        route.savedKm.toStringAsFixed(1),
                        route.savedPct.toStringAsFixed(0),
                      ),
                      style: TextStyle(
                        fontSize: 12.5,
                        color: t.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (route.updatedAt != null) ...[
            const SizedBox(height: 10),
            Text(
              l10n.routeUpdatedAt(_time(route.updatedAt!)),
              style: TextStyle(fontSize: 11.5, color: t.muted),
            ),
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
      child: Column(
        children: [
          Icon(icon, size: 16, color: t.muted),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11, color: t.muted)),
        ],
      ),
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
        child: Text(
          label,
          style: TextStyle(
              fontSize: 11, color: color, fontWeight: FontWeight.w700),
        ),
      );
}

/// Ligação para o resumo do dia anterior, dentro da Minha Rota.
class _KaizenEntry extends StatelessWidget {
  const _KaizenEntry();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return NavixCard(
      padding: EdgeInsets.zero,
      // `Material` transparente: o cartão já pinta o fundo, e sem isto o
      // `ListTile` tenta pintar o seu por cima e perde o efeito do toque.
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          leading: const Icon(Icons.wb_twilight_outlined),
          title: Text(l10n.kaizenScreenTitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const KaizenDailyPage()),
          ),
        ),
      ),
    );
  }
}

class _DestinationOverview extends StatelessWidget {
  const _DestinationOverview({required this.groups});

  final List<RouteGroup> groups;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final group in groups)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: t.surfaceAlt,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: t.line),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  destinationIcon(group.type),
                  size: 17,
                  color: t.accent,
                ),
                const SizedBox(width: 7),
                Text(
                  destinationLabel(l10n, group.type),
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: t.accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${group.stops}',
                    style: TextStyle(
                      color: t.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _DeliveryOrder extends StatelessWidget {
  const _DeliveryOrder({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final stops = [...route.stops]
      ..sort((a, b) => a.sequence.compareTo(b.sequence));

    return NavixCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var index = 0; index < stops.length; index++) ...[
            _StopTile(
              stop: stops[index],
              destinationType: _destinationTypeFor(route, stops[index]),
            ),
            if (index != stops.length - 1)
              Divider(height: 1, indent: 52, color: t.line),
          ],
        ],
      ),
    );
  }

  static String _destinationTypeFor(MyRoute route, RouteStopInfo stop) {
    for (final group in route.groups) {
      if (group.sequences.contains(stop.sequence)) return group.type;
    }
    return 'other';
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({required this.stop, required this.destinationType});

  final RouteStopInfo stop;
  final String destinationType;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${stop.sequence}',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: t.accent,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stop.addressLine.isEmpty ? '—' : stop.addressLine,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (stop.cityLine.isNotEmpty)
                  Text(
                    stop.cityLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, color: t.muted),
                  ),
                const SizedBox(height: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: t.surfaceAlt,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: t.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        destinationIcon(destinationType),
                        size: 12,
                        color: t.muted,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        destinationLabel(l10n, destinationType),
                        style: TextStyle(fontSize: 10.5, color: t.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              '${stop.etaMinutes.round()} min',
              style: TextStyle(fontSize: 11.5, color: t.muted),
            ),
          ),
        ],
      ),
    );
  }
}
