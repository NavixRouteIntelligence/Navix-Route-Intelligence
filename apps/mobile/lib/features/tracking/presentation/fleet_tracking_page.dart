import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../domain/fleet_tracking.dart';
import 'fleet_tracking_cubit.dart';

(Color, String) _statusStyle(BuildContext context, TrackStatus s) {
  final t = context.tokens;
  return switch (s) {
    TrackStatus.enRoute => (t.accent, 'Em rota'),
    TrackStatus.stopped => (t.warning, 'Parado'),
    TrackStatus.finished => (Theme.of(context).colorScheme.primary, 'Finalizado'),
    TrackStatus.offline => (t.muted, 'Offline'),
  };
}

String _age(DateTime? at) {
  if (at == null) return 'sem sinal';
  final s = DateTime.now().difference(at).inSeconds;
  if (s < 0) return 'agora';
  if (s < 60) return 'há ${s}s';
  final m = s ~/ 60;
  if (m < 60) return 'há ${m}min';
  return 'há ${m ~/ 60}h';
}

String _hhmm(DateTime at) {
  final l = at.toLocal();
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

/// Rastreamento da frota (Empresa): mapa ao vivo + bottom sheet de motoristas,
/// detalhe com timeline, alertas e estados online/offline.
class FleetTrackingPage extends StatelessWidget {
  const FleetTrackingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<FleetTrackingCubit>()..load(),
      child: const _FleetView(),
    );
  }
}

class _FleetView extends StatelessWidget {
  const _FleetView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocBuilder<FleetTrackingCubit, FleetTrackingState>(
        builder: (context, state) {
          return switch (state.status) {
            FleetStatus.loading => const _LoadingView(),
            FleetStatus.error => Center(
                child: NavixErrorState(
                  description: state.error ?? 'Não foi possível carregar a frota.',
                  onRetry: () => context.read<FleetTrackingCubit>().load(),
                ),
              ),
            FleetStatus.success => (state.snapshot?.isEmpty ?? true)
                ? const _EmptyView()
                : _FleetContent(state: state),
          };
        },
      ),
    );
  }
}

class _FleetContent extends StatelessWidget {
  const _FleetContent({required this.state});
  final FleetTrackingState state;

  @override
  Widget build(BuildContext context) {
    final snap = state.snapshot!;
    return Stack(
      children: [
        Positioned.fill(
          child: _FleetMap(
            drivers: snap.onMap,
            selectedId: state.selectedId,
            onSelect: (id) => context.read<FleetTrackingCubit>().select(id),
          ),
        ),
        SafeArea(bottom: false, child: _TopBar(snap: snap, live: state.live)),
        DraggableScrollableSheet(
          initialChildSize: 0.42,
          minChildSize: 0.14,
          maxChildSize: 0.92,
          builder: (context, controller) {
            final selected = state.selected;
            return Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                border: Border.all(color: context.tokens.line),
              ),
              child: selected == null
                  ? _DriverListSheet(state: state, controller: controller)
                  : _DriverDetailSheet(state: state, driver: selected, controller: controller),
            );
          },
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Topbar sobre o mapa
// ---------------------------------------------------------------------------

class _TopBar extends StatelessWidget {
  const _TopBar({required this.snap, required this.live});
  final FleetSnapshot snap;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: t.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Frota ao vivo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('${snap.onlineCount} online · ${snap.offlineCount} offline · atualizado ${_age(snap.updatedAt)}',
                      style: TextStyle(fontSize: 11.5, color: t.muted)),
                ],
              ),
            ),
            InkWell(
              onTap: () => context.read<FleetTrackingCubit>().toggleLive(),
              borderRadius: BorderRadius.circular(999),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: (live ? t.accent : t.muted).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(live ? Icons.circle : Icons.pause, size: 9, color: live ? t.accent : t.muted),
                  const SizedBox(width: 6),
                  Text(live ? 'ao vivo' : 'pausado', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: live ? t.accent : t.muted)),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mapa ilustrativo com posições reais (normalizadas)
// ---------------------------------------------------------------------------

class _FleetMap extends StatelessWidget {
  const _FleetMap({required this.drivers, required this.selectedId, required this.onSelect});
  final List<TrackedDriver> drivers;
  final String? selectedId;
  final void Function(String) onSelect;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return LayoutBuilder(
      builder: (context, box) {
        final size = Size(box.maxWidth, box.maxHeight);
        final placed = _project(drivers, size);
        return Container(
          color: t.surfaceAlt,
          child: Stack(
            children: [
              Positioned.fill(child: CustomPaint(painter: _GridPainter(color: t.line))),
              Positioned(
                right: 12,
                bottom: 120,
                child: Text('Mapa ilustrativo · posições reais', style: TextStyle(fontSize: 10.5, color: t.muted)),
              ),
              for (final d in drivers)
                if (placed[d.id] != null)
                  Positioned(
                    key: ValueKey(d.id),
                    left: placed[d.id]!.dx - (d.id == selectedId ? 40 : 6),
                    top: placed[d.id]!.dy - 6 - (d.id == selectedId ? 18 : 0),
                    child: _MapPin(
                      driver: d,
                      selected: d.id == selectedId,
                      onTap: () => onSelect(d.id),
                    ),
                  ),
            ],
          ),
        );
      },
    );
  }

  /// Projeta lat/lng no canvas (norte para cima), com margem.
  Map<String, Offset> _project(List<TrackedDriver> ds, Size size) {
    final pts = ds.where((d) => d.hasPosition).toList();
    if (pts.isEmpty) return const {};
    var minLat = pts.first.latitude!, maxLat = minLat, minLng = pts.first.longitude!, maxLng = minLng;
    for (final d in pts) {
      minLat = d.latitude! < minLat ? d.latitude! : minLat;
      maxLat = d.latitude! > maxLat ? d.latitude! : maxLat;
      minLng = d.longitude! < minLng ? d.longitude! : minLng;
      maxLng = d.longitude! > maxLng ? d.longitude! : maxLng;
    }
    const pad = 44.0;
    final w = size.width - pad * 2, h = size.height - pad * 2 - 80; // reserva espaço p/ sheet
    double nx(double lng) => (maxLng - minLng).abs() < 1e-9 ? size.width / 2 : pad + (lng - minLng) / (maxLng - minLng) * w;
    double ny(double lat) => (maxLat - minLat).abs() < 1e-9 ? (size.height - 80) / 2 : pad + (maxLat - lat) / (maxLat - minLat) * h;
    return {for (final d in pts) d.id: Offset(nx(d.longitude!), ny(d.latitude!))};
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1;
    const step = 46.0;
    for (var x = step; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    for (var y = step; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.color != color;
}

class _MapPin extends StatelessWidget {
  const _MapPin({required this.driver, required this.selected, required this.onTap});
  final TrackedDriver driver;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (color, _) = _statusStyle(context, driver.status);
    final r = selected ? 9.0 : 6.0;
    final faded = driver.status == TrackStatus.offline;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (selected)
            Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: context.tokens.line)),
              child: Text(driver.name.split(' ').first, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600)),
            ),
          Opacity(
            opacity: faded ? 0.45 : 1,
            child: Container(
              width: r * 2,
              height: r * 2,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: selected ? Colors.white : Theme.of(context).colorScheme.surface, width: selected ? 2.5 : 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom sheet — lista de motoristas
// ---------------------------------------------------------------------------

class _DriverListSheet extends StatelessWidget {
  const _DriverListSheet({required this.state, required this.controller});
  final FleetTrackingState state;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final snap = state.snapshot!;
    final alerts = state.alerts;
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: t.line, borderRadius: BorderRadius.circular(999)))),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(child: Text('Motoristas (${snap.drivers.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            _LegendDot(color: t.accent, label: 'Em rota'),
            const SizedBox(width: 8),
            _LegendDot(color: t.warning, label: 'Parado'),
            const SizedBox(width: 8),
            _LegendDot(color: t.muted, label: 'Offline'),
          ],
        ),
        const SizedBox(height: 12),
        if (alerts.isNotEmpty) ...[
          _AlertsCard(alerts: alerts),
          const SizedBox(height: 12),
        ],
        ...snap.drivers.map((d) => _DriverTile(driver: d, onTap: () => context.read<FleetTrackingCubit>().select(d.id))),
      ],
    );
  }
}

class _DriverTile extends StatelessWidget {
  const _DriverTile({required this.driver, required this.onTap});
  final TrackedDriver driver;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (color, label) = _statusStyle(context, driver.status);
    final speed = driver.speedKmh != null ? '${driver.speedKmh!.round()} km/h' : '—';
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            CircleAvatar(radius: 18, backgroundColor: color.withValues(alpha: 0.16), child: Text(_initials(driver.name), style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(driver.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text('$speed · ${driver.gpsStale ? 'GPS instável' : _age(driver.recordedAt)}', style: TextStyle(fontSize: 11.5, color: driver.gpsStale ? t.danger : t.muted)),
                ],
              ),
            ),
            NavixStatusPill(label: label, color: color),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom sheet — detalhe + timeline
// ---------------------------------------------------------------------------

class _DriverDetailSheet extends StatelessWidget {
  const _DriverDetailSheet({required this.state, required this.driver, required this.controller});
  final FleetTrackingState state;
  final TrackedDriver driver;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (color, label) = _statusStyle(context, driver.status);
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: t.line, borderRadius: BorderRadius.circular(999)))),
        const SizedBox(height: 12),
        Row(
          children: [
            IconButton(onPressed: () => context.read<FleetTrackingCubit>().clearSelection(), icon: const Icon(Icons.arrow_back), visualDensity: VisualDensity.compact),
            const SizedBox(width: 4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(driver.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  Text(driver.plate ?? 'Veículo não informado', style: TextStyle(color: t.muted, fontSize: 12.5)),
                ],
              ),
            ),
            NavixStatusPill(label: label, color: color),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _Metric(value: driver.speedKmh != null ? '${driver.speedKmh!.round()}' : '—', unit: 'km/h', label: 'velocidade')),
            const SizedBox(width: 10),
            Expanded(child: _Metric(value: _age(driver.recordedAt), label: 'última posição')),
            const SizedBox(width: 10),
            Expanded(child: _Metric(value: driver.gpsStale ? 'instável' : (driver.isOnline ? 'ok' : 'offline'), label: 'GPS', color: driver.gpsStale ? t.danger : (driver.isOnline ? t.success : t.muted))),
          ],
        ),
        const SizedBox(height: 8),
        Text('ETA por parada indisponível nesta versão (depende do plano de rota do motorista).', style: TextStyle(color: t.muted, fontSize: 11.5)),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: OutlinedButton.icon(onPressed: () => _snack(context, 'Ligar — em breve.'), icon: const Icon(Icons.call_outlined, size: 18), label: const Text('Ligar'))),
            const SizedBox(width: 10),
            Expanded(child: OutlinedButton.icon(onPressed: () => _snack(context, 'Mensagem — em breve.'), icon: const Icon(Icons.chat_bubble_outline, size: 18), label: const Text('Mensagem'))),
          ],
        ),
        const SizedBox(height: 20),
        const NavixSectionHeader(title: 'Timeline', icon: Icons.timeline_outlined),
        if (state.historyLoading)
          const NavixCard(child: NavixSkeleton(height: 60))
        else if (state.history.isEmpty)
          Text('Sem histórico de posições recente.', style: TextStyle(color: t.muted, fontSize: 13))
        else
          _Timeline(points: state.history.take(12).toList()),
      ],
    );
  }

  void _snack(BuildContext context, String m) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.points});
  final List<TrackPoint> points;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      children: [
        for (var i = 0; i < points.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(width: 10, height: 10, margin: const EdgeInsets.only(top: 3), decoration: BoxDecoration(color: _statusStyle(context, points[i].status).$1, shape: BoxShape.circle)),
                    if (i < points.length - 1) Expanded(child: Container(width: 1.5, color: t.line)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(
                      children: [
                        Expanded(child: Text(_statusStyle(context, points[i].status).$2, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                        Text('${points[i].speedKmh != null ? '${points[i].speedKmh!.round()} km/h · ' : ''}${_hhmm(points[i].recordedAt)}', style: TextStyle(color: t.muted, fontSize: 11.5)),
                      ],
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

// ---------------------------------------------------------------------------
// Comuns
// ---------------------------------------------------------------------------

class _AlertsCard extends StatelessWidget {
  const _AlertsCard({required this.alerts});
  final List<FleetAlert> alerts;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.warning_amber_rounded, size: 16, color: t.warning),
            const SizedBox(width: 6),
            Text('${alerts.length} alerta(s)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          ...alerts.take(4).map((a) {
            final color = a.severity == 'danger' ? t.danger : t.warning;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(child: Text(a.message, style: const TextStyle(fontSize: 12.5))),
              ]),
            );
          }),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, this.unit, required this.label, this.color});
  final String value;
  final String? unit;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
            Flexible(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color))),
            if (unit != null) ...[const SizedBox(width: 3), Text(unit!, style: TextStyle(fontSize: 11, color: t.muted))],
          ]),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: t.muted, fontSize: 10.5)),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(fontSize: 10.5, color: context.tokens.muted)),
    ]);
  }
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(child: Container(color: context.tokens.surfaceAlt)),
        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            height: 260,
            width: double.infinity,
            decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(20)), border: Border.all(color: context.tokens.line)),
            padding: const EdgeInsets.all(16),
            child: const Column(children: [
              NavixSkeleton(height: 20, width: 160),
              SizedBox(height: 16),
              NavixSkeleton(height: 48),
              SizedBox(height: 12),
              NavixSkeleton(height: 48),
            ]),
          ),
        ),
      ],
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: NavixEmptyState(
        icon: Icons.podcasts_outlined,
        title: 'Nenhum motorista rastreado',
        description: 'Quando os motoristas compartilharem a localização, eles aparecem aqui.',
        actionLabel: 'Atualizar',
        onAction: () => context.read<FleetTrackingCubit>().load(),
      ),
    );
  }
}
