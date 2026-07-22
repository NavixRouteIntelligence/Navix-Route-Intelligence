import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../core/error/failure_l10n.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_donut.dart';
import '../../../core/ui/navix_kpi_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../data/optimizer_repository.dart';
import '../domain/optimizer_models.dart';
import 'optimizer_cubit.dart';

const _fuelLPerKm = 0.12; // fator médio de consumo (L/km) — estimativa
const _fuelPricePerL = 6.0; // R$/L — estimativa

/// Route Optimizer: Entregas → Configurar → Resultado. Única tela para Empresa e
/// Motorista — [scope] só troca o endpoint por papel (ADR-0060).
class OptimizerPage extends StatelessWidget {
  const OptimizerPage({super.key, this.scope = OptimizerScope.company});

  final OptimizerScope scope;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<OptimizerCubit>()
        ..scope = scope
        ..loadDeliveries(),
      child: const _OptimizerView(),
    );
  }
}

class _OptimizerView extends StatelessWidget {
  const _OptimizerView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Route Optimizer')),
      body: BlocConsumer<OptimizerCubit, OptimizerState>(
        listenWhen: (p, c) => p.error != c.error && c.error != null,
        listener: (context, s) => ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(context.failureText(s.error!)))),
        builder: (context, state) {
          final child = switch (state.step) {
            OptimizerStep.deliveries => _DeliveriesStep(state: state),
            OptimizerStep.config => _ConfigStep(state: state),
            OptimizerStep.result => _ResultStep(state: state),
          };
          return AnimatedSwitcher(
            duration: context.tokens.motionBase,
            child: KeyedSubtree(key: ValueKey(state.step), child: child),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Passo 1 — Entregas
// ---------------------------------------------------------------------------

class _DeliveriesStep extends StatelessWidget {
  const _DeliveriesStep({required this.state});
  final OptimizerState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    if (state.loadingDeliveries) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _StepBar(current: OptimizerStep.deliveries),
          SizedBox(height: 16),
          NavixCard(child: NavixSkeleton(height: 48)),
          SizedBox(height: 12),
          NavixCard(child: NavixSkeleton(height: 48)),
          SizedBox(height: 12),
          NavixCard(child: NavixSkeleton(height: 48)),
        ],
      );
    }
    if (state.deliveries.isEmpty) {
      return const Center(
        child: NavixEmptyState(
          icon: Icons.inbox_outlined,
          title: 'Nenhuma entrega pendente',
          description: 'Importe entregas no Import Center para otimizar uma rota.',
        ),
      );
    }
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const _StepBar(current: OptimizerStep.deliveries),
              const SizedBox(height: 16),
              Text('${state.selected.length} selecionadas · ${state.ignoredCount} sem geocodificação (ignoradas)', style: TextStyle(color: t.muted, fontSize: 12.5)),
              const SizedBox(height: 12),
              ...state.deliveries.map((d) => _DeliveryTile(delivery: d, selected: state.selected.contains(d.id), onToggle: () => context.read<OptimizerCubit>().toggle(d.id))),
            ],
          ),
        ),
        _BottomBar(
          child: FilledButton(
            onPressed: state.canOptimize ? () => context.read<OptimizerCubit>().goToConfig() : null,
            style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
            child: Text('Continuar (${state.selected.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}

class _DeliveryTile extends StatelessWidget {
  const _DeliveryTile({required this.delivery, required this.selected, required this.onToggle});
  final SelectableDelivery delivery;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (pColor, pLabel) = _priority(context, delivery.priority);
    final enabled = delivery.geocoded;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Checkbox(value: selected, onChanged: enabled ? (_) => onToggle() : null),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(delivery.addressLine.isEmpty ? 'Endereço indisponível' : delivery.addressLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(enabled ? delivery.cityLine : 'Sem geocodificação', style: TextStyle(color: enabled ? t.muted : t.warning, fontSize: 11.5)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            NavixStatusPill(label: pLabel, color: pColor),
          ],
        ),
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

// ---------------------------------------------------------------------------
// Passo 2 — Configuração
// ---------------------------------------------------------------------------

class _ConfigStep extends StatelessWidget {
  const _ConfigStep({required this.state});
  final OptimizerState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final cubit = context.read<OptimizerCubit>();
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const _StepBar(current: OptimizerStep.config),
              const SizedBox(height: 16),
              NavixCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const NavixSectionHeader(title: 'Parâmetros', icon: Icons.tune_outlined),
                    _SliderRow(
                      label: 'Velocidade média',
                      value: state.averageSpeedKmh,
                      min: 15,
                      max: 80,
                      suffix: 'km/h',
                      onChanged: cubit.setSpeed,
                    ),
                    const SizedBox(height: 8),
                    _SliderRow(
                      label: 'Tempo por parada',
                      value: state.serviceTimeMinutes,
                      min: 0,
                      max: 20,
                      suffix: 'min',
                      onChanged: cubit.setServiceTime,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              NavixCard(
                child: Row(
                  children: [
                    Icon(Icons.route_outlined, size: 18, color: t.accent),
                    const SizedBox(width: 10),
                    Expanded(child: Text('${state.selected.length} paradas · ${state.averageSpeedKmh.round()} km/h · ${state.serviceTimeMinutes.round()} min/parada', style: const TextStyle(fontSize: 13))),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text('Estratégia: vizinho mais próximo + 2-opt (heurística do motor atual).', style: TextStyle(color: t.muted, fontSize: 11.5)),
            ],
          ),
        ),
        _BottomBar(
          child: Row(
            children: [
              OutlinedButton(
                onPressed: state.optimizing ? null : () => cubit.backToDeliveries(),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), padding: const EdgeInsets.symmetric(horizontal: 20)),
                child: const Text('Voltar'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: state.optimizing ? null : () => cubit.optimize(),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
                  child: state.optimizing
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Otimizar rota', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SliderRow extends StatelessWidget {
  const _SliderRow({required this.label, required this.value, required this.min, required this.max, required this.suffix, required this.onChanged});
  final String label;
  final double value;
  final double min;
  final double max;
  final String suffix;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600))),
            Text('${value.round()} $suffix', style: TextStyle(color: t.accent, fontWeight: FontWeight.w700, fontSize: 13.5)),
          ],
        ),
        Slider(value: value, min: min, max: max, divisions: (max - min).round(), onChanged: onChanged),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Passo 3 — Resultado
// ---------------------------------------------------------------------------

class _ResultStep extends StatelessWidget {
  const _ResultStep({required this.state});
  final OptimizerState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final r = state.result!;
    final cubit = context.read<OptimizerCubit>();
    final scoreBand = r.score >= 80 ? t.success : (r.score >= 50 ? t.warning : t.danger);
    final savedL = r.savings.distanceKm * _fuelLPerKm;
    final savedReais = savedL * _fuelPricePerL;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const _StepBar(current: OptimizerStep.result),
              const SizedBox(height: 16),

              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.7,
                children: [
                  NavixKpiCard(icon: Icons.navigation_outlined, label: 'Distância', value: '${r.metrics.totalDistanceKm.toStringAsFixed(1)} km', iconColor: t.accent, deltaLabel: r.savings.distancePct > 0 ? '−${r.savings.distancePct.toStringAsFixed(0)}%' : null),
                  NavixKpiCard(icon: Icons.timer_outlined, label: 'Tempo', value: _fmtMin(r.metrics.totalTimeMinutes), iconColor: t.warning, deltaLabel: r.savings.timePct > 0 ? '−${r.savings.timePct.toStringAsFixed(0)}%' : null),
                  NavixKpiCard(icon: Icons.place_outlined, label: 'Paradas', value: '${r.metrics.stops}', iconColor: Theme.of(context).colorScheme.primary),
                  _ScoreKpi(score: r.score, band: scoreBand),
                ],
              ),
              const SizedBox(height: 16),

              NavixCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const NavixSectionHeader(title: 'Antes × Depois', icon: Icons.compare_arrows_outlined),
                    _CompareBar(label: 'Distância', before: r.baseline.totalDistanceKm, after: r.metrics.totalDistanceKm, unit: 'km', pct: r.savings.distancePct),
                    const SizedBox(height: 14),
                    _CompareBar(label: 'Tempo', before: r.baseline.totalTimeMinutes, after: r.metrics.totalTimeMinutes, unit: 'min', pct: r.savings.timePct),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(child: _SaveCard(icon: Icons.local_gas_station_outlined, color: t.success, value: '${savedL.toStringAsFixed(1)} L', sub: '≈ R\$ ${savedReais.toStringAsFixed(0)}', label: 'Combustível')),
                  const SizedBox(width: 12),
                  Expanded(child: _SaveCard(icon: Icons.schedule_outlined, color: t.accent, value: _fmtMin(r.savings.timeMinutes), sub: '−${r.savings.timePct.toStringAsFixed(0)}%', label: 'Tempo')),
                ],
              ),
              const SizedBox(height: 8),
              Text('Economia de combustível estimada ($_fuelLPerKm L/km · R\$ ${_fuelPricePerL.toStringAsFixed(0)}/L).', style: TextStyle(color: t.muted, fontSize: 11)),
              const SizedBox(height: 16),

              NavixCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    NavixSectionHeader(title: 'Sequência', icon: Icons.format_list_numbered_outlined, trailing: Text('${r.stops.length} paradas', style: TextStyle(color: t.muted, fontSize: 12))),
                    ...r.stops.take(30).map((s) => _StopRow(stop: s, address: cubit.addressOf(s.deliveryId))),
                  ],
                ),
              ),
            ],
          ),
        ),
        _BottomBar(
          child: Row(
            children: [
              OutlinedButton(
                onPressed: () => cubit.reset(),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), padding: const EdgeInsets.symmetric(horizontal: 20)),
                child: const Text('Reotimizar'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(const SnackBar(content: Text('Enviar ao motorista — em breve no app.'))),
                  icon: const Icon(Icons.send_outlined, size: 18),
                  label: const Text('Enviar ao motorista', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ScoreKpi extends StatelessWidget {
  const _ScoreKpi({required this.score, required this.band});
  final int score;
  final Color band;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          NavixDonut(
            size: 56,
            centerValue: '$score',
            segments: [DonutSegment(score.toDouble(), band), DonutSegment((100 - score).toDouble(), t.surfaceAlt)],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Score', style: TextStyle(fontSize: 11.5, color: t.muted)),
                const SizedBox(height: 2),
                Text(score >= 80 ? 'Alto' : (score >= 50 ? 'Médio' : 'Baixo'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: band)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareBar extends StatelessWidget {
  const _CompareBar({required this.label, required this.before, required this.after, required this.unit, required this.pct});
  final String label;
  final double before;
  final double after;
  final String unit;
  final double pct;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final max = before <= 0 ? 1.0 : before;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            if (pct > 0) Text('−${pct.toStringAsFixed(0)}%', style: TextStyle(color: t.accent, fontWeight: FontWeight.w700, fontSize: 12.5)),
          ],
        ),
        const SizedBox(height: 8),
        _bar(context, 'Antes', before, before / max, t.muted, unit),
        const SizedBox(height: 6),
        _bar(context, 'Depois', after, (after / max).clamp(0, 1), t.accent, unit),
      ],
    );
  }

  Widget _bar(BuildContext context, String tag, double value, double ratio, Color color, String unit) {
    final t = context.tokens;
    return Row(
      children: [
        SizedBox(width: 44, child: Text(tag, style: TextStyle(fontSize: 11, color: t.muted))),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: ratio.clamp(0, 1)),
              duration: t.motionSlow,
              curve: Curves.easeOutCubic,
              builder: (context, v, _) => LinearProgressIndicator(value: v, minHeight: 10, backgroundColor: t.surfaceAlt, valueColor: AlwaysStoppedAnimation(color)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(width: 64, child: Text('${value.toStringAsFixed(unit == 'km' ? 1 : 0)} $unit', textAlign: TextAlign.right, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600))),
      ],
    );
  }
}

class _SaveCard extends StatelessWidget {
  const _SaveCard({required this.icon, required this.color, required this.value, required this.sub, required this.label});
  final IconData icon;
  final Color color;
  final String value;
  final String sub;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Icon(icon, size: 16, color: color), const SizedBox(width: 6), Text(label, style: TextStyle(fontSize: 11.5, color: t.muted))]),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(sub, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({required this.stop, required this.address});
  final RouteStop stop;
  final String address;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: t.accent.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: Text('${stop.sequence}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: t.accent)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(address, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
          Text('ETA ${_fmtMin(stop.etaMinutes)} · ${stop.cumulativeDistanceKm.toStringAsFixed(1)} km', style: TextStyle(color: t.muted, fontSize: 11)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Comuns
// ---------------------------------------------------------------------------

class _StepBar extends StatelessWidget {
  const _StepBar({required this.current});
  final OptimizerStep current;

  @override
  Widget build(BuildContext context) {
    const steps = [
      (OptimizerStep.deliveries, 'Entregas'),
      (OptimizerStep.config, 'Configurar'),
      (OptimizerStep.result, 'Resultado'),
    ];
    final idx = steps.indexWhere((s) => s.$1 == current);
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: i <= idx ? primary : t.surfaceAlt, shape: BoxShape.circle),
            child: i < idx
                ? const Icon(Icons.check, size: 13, color: Colors.white)
                : Text('${i + 1}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: i <= idx ? Colors.white : t.muted)),
          ),
          const SizedBox(width: 6),
          Text(steps[i].$2, style: TextStyle(fontSize: 12, fontWeight: i == idx ? FontWeight.w700 : FontWeight.w500, color: i <= idx ? primary : t.muted)),
          if (i < steps.length - 1) Expanded(child: Container(height: 2, margin: const EdgeInsets.symmetric(horizontal: 8), color: i < idx ? primary : t.line)),
        ],
      ],
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, border: Border(top: BorderSide(color: context.tokens.line))),
      child: SafeArea(top: false, child: child),
    );
  }
}

String _fmtMin(double minutes) {
  final m = minutes.round();
  if (m >= 60) {
    final h = m ~/ 60;
    final rem = m % 60;
    return rem == 0 ? '${h}h' : '${h}h ${rem}min';
  }
  return '$m min';
}
