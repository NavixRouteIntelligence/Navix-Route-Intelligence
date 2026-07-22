import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_donut.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../../earnings/presentation/earnings_card.dart';
import '../../earnings/presentation/earnings_cubit.dart';
import '../../finance/presentation/finance_card.dart';
import '../../intelligence/data/intelligence_repository.dart';
import '../../intelligence/domain/dwell.dart';
import '../../intelligence/presentation/stop_intelligence_card.dart';
import '../../intelligence/presentation/voice_assistant_button.dart';
import '../../intelligence/presentation/voice_assistant_cubit.dart';
import '../../optimizer/data/optimizer_repository.dart';
import '../../optimizer/presentation/manual_route_page.dart';
import '../../optimizer/presentation/optimizer_page.dart';
import '../../pod/presentation/pod_capture_sheet.dart';
import '../../pod/presentation/pod_sync_cubit.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/driver_dashboard_data.dart';
import 'driver_dashboard_cubit.dart';
import 'location_sharing_cubit.dart';

/// Painel do Motorista — layout do protótipo aprovado, focado em operação com
/// uma mão, poucos toques e leitura rápida. Dados reais com escopo de motorista.
class DriverDashboardPage extends StatelessWidget {
  const DriverDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) => GetIt.instance<DriverDashboardCubit>()
            ..load()
            ..startAutoRefresh(),
        ),
        BlocProvider(create: (_) => GetIt.instance<VoiceAssistantCubit>()),
        BlocProvider(create: (_) => GetIt.instance<EarningsCubit>()..load()),
        // Singletons: persistem enquanto o app vive (não são fechados aqui).
        BlocProvider.value(value: GetIt.instance<LocationSharingCubit>()),
        BlocProvider.value(value: GetIt.instance<PodSyncCubit>()),
      ],
      child: const _DriverView(),
    );
  }
}

class _DriverView extends StatefulWidget {
  const _DriverView();

  @override
  State<_DriverView> createState() => _DriverViewState();
}

class _DriverViewState extends State<_DriverView> {
  // Início do atendimento da parada atual — base do dwell (ADR-0038).
  DateTime _stopStartedAt = DateTime.now();
  String? _stopStartedId;

  void _snack(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Reinicia o cronômetro de dwell quando a parada ativa muda.
  void _syncStopTimer(DriverDashboardData? data) {
    final nextId = data?.next?.id;
    if (nextId != _stopStartedId) {
      _stopStartedId = nextId;
      _stopStartedAt = DateTime.now();
    }
  }

  /// Captura automática do tempo de atendimento (dwell) como observação
  /// coletiva ao concluir a parada (ADR-0031/0038, paridade da ADR-0035).
  void _captureDwell(DriverDelivery stop) {
    if (!stop.hasCoordinates) return;
    final minutes = dwellMinutes(_stopStartedAt, DateTime.now());
    GetIt.instance<IntelligenceRepository>()
        .recordServiceTime(latitude: stop.latitude!, longitude: stop.longitude!, minutes: minutes)
        .catchError((_) {});
  }

  Future<void> _toggleShare() async {
    final cubit = context.read<LocationSharingCubit>();
    await cubit.toggle();
    if (!mounted) return;
    if (cubit.state.sharing) {
      _snack('Compartilhando localização em tempo real.');
    } else if (cubit.state.error == null) {
      _snack('Rastreamento pausado.');
    }
  }

  Future<void> _register(DriverDashboardData data) async {
    final next = data.next;
    if (next == null) {
      _snack('Nenhuma entrega pendente para registrar.');
      return;
    }
    final dashboard = context.read<DriverDashboardCubit>();
    final registered = await showPodCaptureSheet(
      context,
      deliveryId: next.id,
      deliveryLabel: next.addressLine.isEmpty ? null : next.addressLine,
    );
    if (!mounted) return;
    if (registered == true) {
      // Captura o tempo de atendimento antes de recarregar (a parada muda).
      _captureDwell(next);
      // O sheet já dá o feedback (registrado / salvo offline). Atualiza a fila e os dados.
      GetIt.instance<PodSyncCubit>().refresh();
      dashboard.load();
    }
  }

  /// Reage à intenção reconhecida por voz (ADR-0037), ligando-a às ações reais.
  void _onVoiceResult(VoiceAssistantState s) {
    final data = context.read<DriverDashboardCubit>().state.data;
    final next = data?.next;
    switch (s.command?.intent) {
      case 'mark_delivered':
        if (data != null) _register(data);
        break;
      case 'report_parking':
        if (next != null && next.hasCoordinates) {
          GetIt.instance<IntelligenceRepository>()
              .recordParking(
                latitude: next.latitude!,
                longitude: next.longitude!,
                difficulty: s.command?.parkingDifficulty ?? 'hard',
              )
              .catchError((_) {});
        }
        break;
      case 'next_stop':
        _snack(next == null ? 'Rota concluída.' : 'Próxima parada: ${next.addressLine}');
        break;
      case 'remaining':
        _snack(data == null ? 'Sem rota ativa.' : '${data.remaining} parada(s) restantes.');
        break;
      case 'route_summary':
        _snack(data == null
            ? 'Sem rota ativa.'
            : '${data.total} paradas · ${data.delivered} concluídas.');
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sharing = context.watch<LocationSharingCubit>().state.sharing;
    return Scaffold(
      floatingActionButton: const VoiceAssistantButton(),
      body: SafeArea(
        bottom: false,
        child: BlocListener<VoiceAssistantCubit, VoiceAssistantState>(
          listenWhen: (p, c) => p.status != c.status,
          listener: (context, s) {
            if (s.status == VoiceStatus.result) {
              _onVoiceResult(s);
            } else if (s.status == VoiceStatus.unsupported) {
              _snack('Comando de voz indisponível neste dispositivo.');
            } else if (s.status == VoiceStatus.error && s.error != null) {
              _snack(s.error!);
            }
          },
          child: BlocListener<LocationSharingCubit, LocationSharingState>(
          listenWhen: (p, c) => p.error != c.error && c.error != null,
          listener: (context, s) => _snack(s.error!),
          child: BlocConsumer<DriverDashboardCubit, DriverDashboardState>(
            listener: (context, state) => _syncStopTimer(state.data),
            builder: (context, state) {
              final child = switch (state.status) {
                DriverDashboardStatus.loading => const _LoadingView(),
                DriverDashboardStatus.error => state.online
                    ? NavixErrorState(
                        description: state.error ?? 'Não foi possível carregar.',
                        onRetry: () => context.read<DriverDashboardCubit>().load(),
                      )
                    : NavixErrorState(
                        title: AppLocalizations.of(context).offlineTitle,
                        description: AppLocalizations.of(context).offlineDescription,
                        onRetry: () => context.read<DriverDashboardCubit>().load(),
                      ),
                DriverDashboardStatus.success => (state.data?.isEmpty ?? true)
                    ? const NavixEmptyState(
                        icon: Icons.local_shipping_outlined,
                        title: 'Sem rota ativa',
                        description: 'Quando houver entregas atribuídas, sua rota aparece aqui.',
                      )
                    : _Content(
                        data: state.data!,
                        running: sharing,
                        onToggleRun: _toggleShare,
                        onRegister: () => _register(state.data!),
                        onAction: _snack,
                      ),
              };
              return AnimatedSwitcher(
                duration: context.tokens.motionBase,
                child: KeyedSubtree(key: ValueKey(state.status), child: child),
              );
            },
          ),
          ),
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({
    required this.data,
    required this.running,
    required this.onToggleRun,
    required this.onRegister,
    required this.onAction,
  });

  final DriverDashboardData data;
  final bool running;
  final VoidCallback onToggleRun;
  final VoidCallback onRegister;
  final void Function(String) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => context.read<DriverDashboardCubit>().load(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              children: [
                _TopBar(running: running),
                const SizedBox(height: 16),
                const _OfflineBanner(),
                const _SyncBanner(),
                _RouteHero(data: data),
                const SizedBox(height: 12),
                if (data.first != null) ...[
                  _JourneyCard(first: data.first!, last: data.last),
                  const SizedBox(height: 12),
                ],
                if (data.total > 0) ...[
                  _OptimizeMineButton(
                    onDone: () => context.read<DriverDashboardCubit>().load(),
                  ),
                  const SizedBox(height: 8),
                  _ReorderRouteButton(
                    onDone: () => context.read<DriverDashboardCubit>().load(),
                  ),
                  const SizedBox(height: 12),
                ],
                if (data.next != null) ...[
                  _NextDelivery(delivery: data.next!, onAction: onAction),
                  const SizedBox(height: 12),
                  if (data.next!.hasCoordinates) ...[
                    StopIntelligenceCard(
                      latitude: data.next!.latitude!,
                      longitude: data.next!.longitude!,
                    ),
                    const SizedBox(height: 12),
                  ],
                ],
                _MiniMap(),
                const SizedBox(height: 12),
                _TrackingCard(tracking: data.tracking),
                const SizedBox(height: 12),
                _PodCard(podToday: data.podToday, onRegister: onRegister),
                const SizedBox(height: 12),
                _KpiRow(data: data),
                const SizedBox(height: 12),
                EarningsCard(deliveries: data.total, km: data.remainingKm ?? 0),
                const SizedBox(height: 12),
                const FinanceCard(),
                const SizedBox(height: 12),
                _AiInsights(data: data),
              ],
            ),
          ),
        ),
        _ActionBar(running: running, onToggleRun: onToggleRun, onRegister: onRegister),
      ],
    );
  }
}

/// Banner de conexão (M5): aparece quando o dispositivo está offline. O painel
/// segue mostrando o último dado bom em cache; o polling pausa até reconectar.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return BlocSelector<DriverDashboardCubit, DriverDashboardState, bool>(
      selector: (state) => state.online,
      builder: (context, online) {
        if (online) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: NavixCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(Icons.cloud_off_outlined, size: 16, color: t.warning),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l10n.offlineBanner,
                    style: TextStyle(fontSize: 12.5, color: t.warning, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Banner de comprovantes aguardando sincronização (fila offline).
class _SyncBanner extends StatelessWidget {
  const _SyncBanner();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return BlocBuilder<PodSyncCubit, PodSyncState>(
      builder: (context, sync) {
        if (sync.pending == 0 && !sync.syncing) return const SizedBox.shrink();
        final color = sync.syncing ? t.accent : t.warning;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: NavixCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                if (sync.syncing)
                  SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(color)))
                else
                  Icon(Icons.cloud_upload_outlined, size: 16, color: color),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    sync.syncing
                        ? 'Sincronizando comprovantes…'
                        : '${sync.pending} comprovante(s) aguardando sincronização',
                    style: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w600),
                  ),
                ),
                if (!sync.syncing && sync.online)
                  TextButton(onPressed: () => context.read<PodSyncCubit>().syncNow(), child: const Text('Sincronizar')),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.running});
  final bool running;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final theme = GetIt.instance<ThemeCubit>();
    final (color, label) = running ? (t.accent, 'Em rota') : (t.muted, 'Pausado');
    return Row(
      children: [
        const NavMenuButton(),
        const SizedBox(width: 4),
        CircleAvatar(radius: 22, backgroundColor: Theme.of(context).colorScheme.primary, child: const Text('CA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Olá, motorista', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Row(mainAxisSize: MainAxisSize.min, children: [
                _LiveDot(color: color, animate: running),
                const SizedBox(width: 6),
                Text(label, style: TextStyle(color: color, fontSize: 12.5, fontWeight: FontWeight.w600)),
              ]),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Tema',
          onPressed: () {
            final dark = Theme.of(context).brightness == Brightness.dark;
            theme.setMode(dark ? ThemeMode.light : ThemeMode.dark);
          },
          icon: Icon(Theme.of(context).brightness == Brightness.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
        ),
      ],
    );
  }
}

/// Botão "Otimizar minha rota" (S3). Abre a única [OptimizerPage] em escopo do
/// motorista (`/route-plans/mine`); ao voltar, recarrega o dashboard para
/// refletir a rota otimizada ("Minha rota — entrega 1 de N").
class _OptimizeMineButton extends StatelessWidget {
  const _OptimizeMineButton({required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: double.infinity,
      child: FilledButton.tonalIcon(
        onPressed: () async {
          await Navigator.of(context).push<void>(
            MaterialPageRoute(
              builder: (_) => const OptimizerPage(scope: OptimizerScope.mine),
            ),
          );
          onDone();
        },
        icon: const Icon(Icons.route_outlined),
        label: Text(l10n.optimizeMyRoute),
        style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
      ),
    );
  }
}

/// Indicador "ao vivo" do painel (M2). Mostra o pulso quando está recebendo
/// atualizações + o frescor ("há Xs"); tocar pausa/retoma o tempo real.
class _LivePill extends StatelessWidget {
  const _LivePill();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<DriverDashboardCubit, DriverDashboardState>(
      buildWhen: (p, c) => p.live != c.live || p.lastUpdatedAt != c.lastUpdatedAt,
      builder: (context, state) {
        final t = context.tokens;
        final live = state.live;
        final color = live ? t.accent : t.muted;
        final age = state.lastUpdatedAt;
        final label = live
            ? (age != null ? '${l10n.live} · ${_fmtAge(age)}' : l10n.live)
            : l10n.paused;
        return Semantics(
          button: true,
          label: label,
          child: Material(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
            child: InkWell(
              onTap: () => context.read<DriverDashboardCubit>().toggleLive(),
              borderRadius: BorderRadius.circular(999),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (live)
                      _LiveDot(color: color, animate: true)
                    else
                      Icon(Icons.pause, size: 12, color: color),
                    const SizedBox(width: 6),
                    Text(label, style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Abre a tela de ordem manual (RSE-2b): reordenar arrastando + travar posições.
/// Ao voltar com sucesso, recarrega o dashboard (a rota mudou).
class _ReorderRouteButton extends StatelessWidget {
  const _ReorderRouteButton({required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () async {
          final saved = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const ManualRoutePage()),
          );
          if (saved == true) onDone();
        },
        icon: const Icon(Icons.swap_vert_outlined),
        label: Text(l10n.manualRouteTitle),
        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
      ),
    );
  }
}

class _RouteHero extends StatelessWidget {
  const _RouteHero({required this.data});
  final DriverDashboardData data;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    final etaText = data.remainingMinutes != null ? _fmtDuration(data.remainingMinutes!) : '—';
    final kmText = data.remainingKm != null ? '${data.remainingKm!.toStringAsFixed(1)} km' : '—';
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Expanded(child: NavixSectionHeader(title: 'Minha rota', icon: Icons.alt_route_outlined)),
              _LivePill(),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('Entrega ${data.currentIndex}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
              const SizedBox(width: 6),
              Text('de ${data.total}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: t.muted)),
              const Spacer(),
              Text('${(data.progress * 100).round()}%', style: TextStyle(color: t.accent, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: data.progress),
              duration: t.motionSlow,
              curve: Curves.easeOutCubic,
              builder: (context, v, _) => LinearProgressIndicator(
                value: v,
                minHeight: 10,
                backgroundColor: t.surfaceAlt,
                valueColor: AlwaysStoppedAnimation(primary),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _MiniStat(value: kmText, label: 'restantes')),
              const SizedBox(width: 8),
              Expanded(child: _MiniStat(value: etaText, label: 'tempo restante')),
              const SizedBox(width: 8),
              Expanded(child: _MiniStat(value: '${data.remaining}', label: 'paradas à frente')),
            ],
          ),
        ],
      ),
    );
  }
}

/// Jornada de hoje: primeira e última paradas (M1). Emoldura o dia do
/// motorista — quando começa e quando termina — a partir das janelas de horário.
class _JourneyCard extends StatelessWidget {
  const _JourneyCard({required this.first, this.last});
  final DriverDelivery first;
  final DriverDelivery? last;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NavixSectionHeader(title: l10n.journeyToday, icon: Icons.flag_outlined),
          _JourneyRow(
            icon: Icons.trip_origin,
            label: l10n.firstDelivery,
            delivery: first,
          ),
          if (last != null) ...[
            const SizedBox(height: 10),
            _JourneyRow(
              icon: Icons.place,
              label: l10n.lastDelivery,
              delivery: last!,
            ),
          ],
        ],
      ),
    );
  }
}

class _JourneyRow extends StatelessWidget {
  const _JourneyRow({required this.icon, required this.label, required this.delivery});
  final IconData icon;
  final String label;
  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final time = delivery.windowStart != null ? _fmtTime(delivery.windowStart!) : '—';
    final address = delivery.addressLine.isEmpty ? delivery.cityLine : delivery.addressLine;
    return Row(
      children: [
        Icon(icon, size: 16, color: t.accent),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 11.5, color: t.muted)),
              const SizedBox(height: 2),
              Text(
                address.isEmpty ? '—' : address,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(time, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _NextDelivery extends StatelessWidget {
  const _NextDelivery({required this.delivery, required this.onAction});
  final DriverDelivery delivery;
  final void Function(String) onAction;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (pColor, pLabel) = _priority(context, delivery.priority);
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: NavixSectionHeader(title: 'Próxima entrega', icon: Icons.place_outlined)),
              NavixStatusPill(label: pLabel, color: pColor),
            ],
          ),
          Text(delivery.addressLine.isEmpty ? 'Endereço indisponível' : delivery.addressLine, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          if (delivery.cityLine.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(delivery.cityLine, style: TextStyle(color: t.muted, fontSize: 13.5)),
          ],
          const SizedBox(height: 12),
          if (delivery.windowStart != null && delivery.windowEnd != null)
            _Chip(icon: Icons.schedule, label: '${_fmtTime(delivery.windowStart!)} – ${_fmtTime(delivery.windowEnd!)}'),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _ActionButton(icon: Icons.call_outlined, label: 'Ligar', onTap: () => onAction('Ligar — em breve no app.'))),
              const SizedBox(width: 10),
              Expanded(child: _ActionButton(icon: Icons.navigation_outlined, label: 'Navegar', accent: true, onTap: () => onAction('Navegação — em breve no app.'))),
            ],
          ),
        ],
      ),
    );
  }

  (Color, String) _priority(BuildContext context, String p) {
    final t = context.tokens;
    return switch (p) {
      'urgent' => (t.danger, 'Urgente'),
      'high' => (t.warning, 'Alta'),
      'low' => (t.muted, 'Baixa'),
      _ => (Theme.of(context).colorScheme.primary, 'Normal'),
    };
  }
}

class _MiniMap extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    return NavixCard(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            SizedBox(
              height: 150,
              width: double.infinity,
              child: CustomPaint(painter: _MiniMapPainter(line: t.line, route: primary, pin: t.accent, bg: t.surfaceAlt)),
            ),
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.85), borderRadius: BorderRadius.circular(999), border: Border.all(color: t.accent.withValues(alpha: 0.4))),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  _LiveDot(color: t.accent, animate: true),
                  const SizedBox(width: 6),
                  Text('ao vivo', style: TextStyle(color: t.accent, fontSize: 11.5, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
            Positioned(
              bottom: 8,
              right: 10,
              child: Text('mapa ilustrativo', style: TextStyle(color: t.muted, fontSize: 10.5)),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniMapPainter extends CustomPainter {
  _MiniMapPainter({required this.line, required this.route, required this.pin, required this.bg});
  final Color line;
  final Color route;
  final Color pin;
  final Color bg;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    canvas.drawRect(Offset.zero & size, Paint()..color = bg);

    final grid = Paint()
      ..color = line
      ..strokeWidth = 1.5;
    for (var y = h * 0.35; y < h; y += h * 0.34) {
      canvas.drawLine(Offset(0, y), Offset(w, y), grid);
    }
    for (var x = w * 0.25; x < w; x += w * 0.25) {
      canvas.drawLine(Offset(x, 0), Offset(x, h), grid);
    }

    final path = Path()
      ..moveTo(w * 0.25, h * 0.69)
      ..lineTo(w * 0.55, h * 0.69)
      ..lineTo(w * 0.55, h * 0.35)
      ..lineTo(w * 0.78, h * 0.35)
      ..lineTo(w * 0.88, h * 0.2);
    canvas.drawPath(path, Paint()
      ..color = route
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round);

    // posição atual
    final cur = Offset(w * 0.25, h * 0.69);
    canvas.drawCircle(cur, 7, Paint()..color = route);
    canvas.drawCircle(cur, 7, Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5);
    // pino da próxima parada
    final pinPos = Offset(w * 0.88, h * 0.2);
    canvas.drawCircle(pinPos, 6, Paint()..color = pin);
    canvas.drawCircle(pinPos, 2.5, Paint()..color = bg);
  }

  @override
  bool shouldRepaint(_MiniMapPainter old) => old.route != route || old.bg != bg;
}

class _TrackingCard extends StatelessWidget {
  const _TrackingCard({required this.tracking});
  final DriverTracking tracking;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final speed = tracking.speedKmh != null ? '${tracking.speedKmh!.round()}' : '—';
    final age = tracking.recordedAt != null ? _fmtAge(tracking.recordedAt!) : 'sem sinal';
    final gps = tracking.hasFix ? 'GPS ativo' : 'GPS fraco';
    return NavixCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(child: _TStat(value: speed, unit: 'km/h', label: 'velocidade')),
            _Divider(color: t.line),
            Expanded(child: _TStat(value: age, label: 'última posição')),
            _Divider(color: t.line),
            Expanded(child: _TStat(value: gps, label: 'sinal', valueColor: tracking.hasFix ? t.success : t.warning)),
          ],
        ),
      ),
    );
  }
}

class _PodCard extends StatelessWidget {
  const _PodCard({required this.podToday, required this.onRegister});
  final int podToday;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const NavixSectionHeader(title: 'Comprovante de entrega', icon: Icons.verified_outlined),
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
                child: Icon(Icons.photo_camera_outlined, color: t.muted),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Foto + assinatura', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 3),
                    Text('$podToday comprovante(s) registrados', style: TextStyle(color: t.muted, fontSize: 11.5)),
                  ],
                ),
              ),
              FilledButton(onPressed: onRegister, child: const Text('Registrar')),
            ],
          ),
        ],
      ),
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.data});
  final DriverDashboardData data;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Column(
            children: [
              _EconomyCard(savedKm: data.savedKm, savingsPct: data.avgSavingsPct),
              const SizedBox(height: 12),
              _TimeCard(remainingMinutes: data.remainingMinutes),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: _ScoreCard(score: data.score)),
      ],
    );
  }
}

class _EconomyCard extends StatelessWidget {
  const _EconomyCard({this.savedKm, this.savingsPct});
  final double? savedKm;
  final double? savingsPct;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.eco_outlined, size: 16, color: t.success),
            const SizedBox(width: 6),
            Text('Economia', style: TextStyle(fontSize: 11.5, color: t.muted)),
          ]),
          const SizedBox(height: 8),
          Text(savedKm != null ? '${savedKm!.toStringAsFixed(1)} km' : '—', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          if (savingsPct != null && savingsPct! > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: t.success.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
              child: Text('▲ ${savingsPct!.toStringAsFixed(0)}% otimizado', style: TextStyle(color: t.success, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ],
        ],
      ),
    );
  }
}

class _TimeCard extends StatelessWidget {
  const _TimeCard({this.remainingMinutes});
  final int? remainingMinutes;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.timer_outlined, size: 16, color: t.warning),
            const SizedBox(width: 6),
            Text('Tempo restante', style: TextStyle(fontSize: 11.5, color: t.muted)),
          ]),
          const SizedBox(height: 8),
          Text(remainingMinutes != null ? _fmtDuration(remainingMinutes!) : '—', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({this.score});
  final int? score;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final s = score ?? 0;
    final (band, label) = switch (s) {
      >= 80 => (t.success, 'Alto'),
      >= 50 => (t.warning, 'Médio'),
      _ => (t.danger, 'Baixo'),
    };
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Score de eficiência', textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: t.muted)),
          const SizedBox(height: 12),
          if (score == null)
            Text('—', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: t.muted))
          else
            NavixDonut(
              centerValue: '$s',
              centerLabel: 'de 100',
              segments: [DonutSegment(s.toDouble(), band), DonutSegment((100 - s).toDouble(), t.surfaceAlt)],
            ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(color: band.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
            child: Text(score == null ? 'sem dados' : label, style: TextStyle(color: score == null ? t.muted : band, fontSize: 11.5, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _AiInsights extends StatelessWidget {
  const _AiInsights({required this.data});
  final DriverDashboardData data;

  @override
  Widget build(BuildContext context) {
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const NavixSectionHeader(title: 'IA Insights', icon: Icons.auto_awesome_outlined),
          ..._insights(context, data),
        ],
      ),
    );
  }

  List<Widget> _insights(BuildContext context, DriverDashboardData d) {
    final t = context.tokens;
    final items = <(Color, String)>[];

    final next = d.next;
    if (next?.windowEnd != null) {
      final mins = next!.windowEnd!.difference(DateTime.now()).inMinutes;
      if (mins >= 0 && mins <= 30) {
        items.add((t.warning, 'Janela da próxima entrega fecha em ~$mins min — priorize.'));
      }
    }
    if (!d.tracking.hasFix || (d.tracking.recordedAt != null && DateTime.now().difference(d.tracking.recordedAt!).inSeconds > 90)) {
      items.add((t.warning, 'Sinal de GPS instável — verifique a conexão para o rastreamento.'));
    }
    if (d.avgSavingsPct != null && d.avgSavingsPct! > 0) {
      items.add((t.accent, 'Rota otimizada economiza ~${d.avgSavingsPct!.toStringAsFixed(0)}% de distância.'));
    }
    if (d.remaining > 0) {
      items.add((t.accent, '${d.remaining} parada(s) restantes na rota de hoje.'));
    }
    if (items.isEmpty) {
      items.add((t.success, 'Tudo em dia — siga com a rota atual.'));
    }

    return items.take(3).map((i) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 5), decoration: BoxDecoration(color: i.$1, shape: BoxShape.circle)),
              const SizedBox(width: 10),
              Expanded(child: Text(i.$2, style: const TextStyle(fontSize: 13.5, height: 1.35))),
            ],
          ),
        )).toList();
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.running, required this.onToggleRun, required this.onRegister});
  final bool running;
  final VoidCallback onToggleRun;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, border: Border(top: BorderSide(color: t.line))),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            OutlinedButton.icon(
              onPressed: onToggleRun,
              icon: Icon(running ? Icons.pause : Icons.play_arrow, size: 20),
              label: Text(running ? 'Pausar' : 'Iniciar'),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), padding: const EdgeInsets.symmetric(horizontal: 16)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: onRegister,
                icon: const Icon(Icons.photo_camera_outlined, size: 20),
                label: const Text('Registrar entrega', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sub-widgets utilitários
// ---------------------------------------------------------------------------

class _LiveDot extends StatefulWidget {
  const _LiveDot({required this.color, required this.animate});
  final Color color;
  final bool animate;

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = Container(width: 8, height: 8, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle));
    if (!widget.animate) return dot;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => SizedBox(
        width: 8,
        height: 8,
        child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
          Opacity(
            opacity: (1 - _c.value) * 0.6,
            child: Container(width: 8 + _c.value * 10, height: 8 + _c.value * 10, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: widget.color))),
          ),
          child!,
        ]),
      ),
      child: dot,
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: t.muted, fontSize: 10.5)),
        ],
      ),
    );
  }
}

class _TStat extends StatelessWidget {
  const _TStat({required this.value, this.unit, required this.label, this.valueColor});
  final String value;
  final String? unit;
  final String label;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: valueColor))),
            if (unit != null) ...[
              const SizedBox(width: 3),
              Text(unit!, style: TextStyle(fontSize: 11.5, color: t.muted)),
            ],
          ],
        ),
        const SizedBox(height: 3),
        Text(label, textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 11)),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(width: 1, color: color, margin: const EdgeInsets.symmetric(horizontal: 4));
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(8), border: Border.all(color: t.line)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: t.muted),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500)),
      ]),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label, required this.onTap, this.accent = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = accent ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurface;
    return Material(
      color: accent ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.14) : t.surfaceAlt,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: accent ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.5) : t.line)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 19, color: color),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
          ]),
        ),
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        NavixSkeleton(height: 44),
        SizedBox(height: 16),
        NavixCard(child: NavixSkeleton(height: 90)),
        SizedBox(height: 12),
        NavixCard(child: NavixSkeleton(height: 110)),
        SizedBox(height: 12),
        NavixCard(child: NavixSkeleton(height: 150)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

String _fmtDuration(int minutes) {
  if (minutes <= 0) return '0 min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h > 0) return m == 0 ? '${h}h' : '${h}h ${m}min';
  return '$m min';
}

String _fmtTime(DateTime dt) {
  final l = dt.toLocal();
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

String _fmtAge(DateTime recordedAt) {
  final secs = DateTime.now().difference(recordedAt).inSeconds;
  if (secs < 0) return 'agora';
  if (secs < 60) return 'há ${secs}s';
  final mins = secs ~/ 60;
  if (mins < 60) return 'há ${mins}min';
  return 'há ${math.min(mins ~/ 60, 99)}h';
}
