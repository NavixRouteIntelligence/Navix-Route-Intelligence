import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../domain/stop_intelligence.dart';
import 'stop_intelligence_cubit.dart';

/// Cartão de inteligência da parada atual (ADR-0028/0029/0031, integração E):
/// estacionamento previsto (ciente da comunidade), acesso e o que a frota
/// aprendeu no local. Gerencia o próprio ciclo de vida do cubit.
class StopIntelligenceCard extends StatefulWidget {
  const StopIntelligenceCard({
    required this.latitude,
    required this.longitude,
    this.vehicleType,
    super.key,
  });

  final double latitude;
  final double longitude;
  final String? vehicleType;

  @override
  State<StopIntelligenceCard> createState() => _StopIntelligenceCardState();
}

class _StopIntelligenceCardState extends State<StopIntelligenceCard> {
  final StopIntelligenceCubit _cubit = GetIt.instance<StopIntelligenceCubit>();

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void didUpdateWidget(StopIntelligenceCard old) {
    super.didUpdateWidget(old);
    if (old.latitude != widget.latitude || old.longitude != widget.longitude) {
      _reload();
    }
  }

  void _reload() {
    _cubit.load(
      latitude: widget.latitude,
      longitude: widget.longitude,
      vehicleType: widget.vehicleType,
    );
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<StopIntelligenceCubit, StopIntelligenceState>(
        builder: (context, state) {
          // Silencioso em erro: não polui a operação do motorista.
          if (state.status == StopIntelligenceStatus.error) {
            return const SizedBox.shrink();
          }
          return NavixCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const NavixSectionHeader(
                  title: 'Inteligência da parada',
                  icon: Icons.insights_outlined,
                ),
                if (state.status == StopIntelligenceStatus.loading)
                  const NavixSkeleton(height: 56)
                else
                  _Body(data: state.data),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.data});
  final StopIntelligence? data;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final d = data;
    if (d == null) return const SizedBox.shrink();

    final rows = <Widget>[];
    final parking = d.parking;
    if (parking != null) {
      final (color, label) = _difficulty(context, parking.difficulty);
      rows.add(_Line(
        icon: Icons.local_parking_outlined,
        child: Row(
          children: [
            NavixStatusPill(label: label, color: color),
            const SizedBox(width: 8),
            Text('${parking.walkMinutes} min a pé', style: TextStyle(color: t.muted, fontSize: 13)),
          ],
        ),
      ));
    }

    for (final tip in d.access) {
      rows.add(_Line(icon: Icons.meeting_room_outlined, child: Text(tip)));
    }

    final insight = d.insight;
    if (insight != null && insight.hasSignal) {
      if (insight.typicalServiceMinutes != null) {
        rows.add(_Line(
          icon: Icons.timer_outlined,
          child: Text('Atendimento típico: ${insight.typicalServiceMinutes!.toStringAsFixed(0)} min'),
        ));
      }
      for (final tip in insight.accessTips) {
        rows.add(_Line(icon: Icons.groups_outlined, child: Text(tip)));
      }
      rows.add(Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text('${insight.sampleSize} observações da frota',
            style: TextStyle(color: t.muted, fontSize: 12)),
      ));
    }

    if (rows.isEmpty) {
      return Text('Sem sinais para esta parada ainda.', style: TextStyle(color: t.muted, fontSize: 13.5));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final row in rows) Padding(padding: const EdgeInsets.only(bottom: 8), child: row),
      ],
    );
  }

  (Color, String) _difficulty(BuildContext context, String difficulty) {
    final t = context.tokens;
    return switch (difficulty) {
      'hard' => (t.danger, 'Estacionamento difícil'),
      'moderate' => (t.warning, 'Estacionamento moderado'),
      _ => (t.success, 'Estacionamento fácil'),
    };
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.child});
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: t.muted),
        const SizedBox(width: 10),
        Expanded(child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 14), child: child)),
      ],
    );
  }
}
