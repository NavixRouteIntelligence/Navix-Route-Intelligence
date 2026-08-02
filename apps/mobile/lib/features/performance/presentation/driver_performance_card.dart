import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/driver_performance.dart';
import 'driver_performance_cubit.dart';

/// Desempenho consolidado do motorista na Minha Rota (ADR-0097).
///
/// ## O que este cartão recusa mostrar
///
/// Nenhuma posição na frota, média dos colegas, entregas por hora ou
/// velocidade. A restrição vive no domínio do backend
/// (`analytics/domain/driver-performance.ts`), não numa escolha de layout que a
/// próxima iteração de design possa desfazer sem perceber.
///
/// A sugestão de descanso é a única mensagem que pede uma ação — e ela pede
/// para parar.
class DriverPerformanceCard extends StatelessWidget {
  const DriverPerformanceCard({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<DriverPerformanceCubit>()..load(),
      child: BlocBuilder<DriverPerformanceCubit, DriverPerformanceState>(
        builder: (context, state) {
          // Falha aqui não vira erro na tela: o cartão é complementar à rota, e
          // uma rota utilizável não deve virar tela de erro por causa dele.
          if (state.status == DriverPerformanceStatus.error) {
            return const SizedBox.shrink();
          }
          if (state.status == DriverPerformanceStatus.loading) {
            return const _Loading();
          }
          return _Body(performance: state.performance);
        },
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => const NavixCard(
        child: SizedBox(
          height: 96,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
}

class _Body extends StatelessWidget {
  const _Body({required this.performance});
  final DriverPerformance performance;

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
              Icon(Icons.insights_outlined, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.perfTitle,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                l10n.perfWindow,
                style: TextStyle(fontSize: 11, color: t.muted),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (!performance.hasData)
            Text(
              l10n.perfEmpty,
              style: TextStyle(fontSize: 12.5, color: t.muted),
            )
          else ...[
            Row(
              children: [
                _Metric(
                  value: '${performance.delivered}',
                  label: l10n.perfDelivered,
                  icon: Icons.check_circle_outline,
                ),
                _Metric(
                  value: '${performance.workedDays}',
                  label: l10n.perfWorkedDays,
                  icon: Icons.calendar_today_outlined,
                ),
                _Metric(
                  value: _percent(performance.successRate),
                  label: l10n.perfSuccessRate,
                  icon: Icons.thumb_up_outlined,
                ),
                _Metric(
                  value: _percent(performance.onTimeRate),
                  label: l10n.perfOnTimeRate,
                  icon: Icons.schedule_outlined,
                ),
              ],
            ),
            if (performance.streak.days > 0) ...[
              const SizedBox(height: 14),
              _Streak(streak: performance.streak),
            ],
            if (performance.goal != null) ...[
              const SizedBox(height: 14),
              _Goal(goal: performance.goal!),
            ],
            if (performance.restAdvice?.longDay ?? false) ...[
              const SizedBox(height: 14),
              _RestAdvice(minutes: performance.restAdvice!.activeMinutes),
            ],
          ],
        ],
      ),
    );
  }
}

/// `null` vira travessão, não "0%": ainda não haver dado não é ter zero.
String _percent(double? value) =>
    value == null ? '—' : '${(value * 100).round()}%';

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label, required this.icon});
  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Expanded(
      // O par número+rótulo é lido como uma coisa só; sem isso o leitor de tela
      // anuncia "96" solto, sem dizer 96 de quê.
      child: Semantics(
        label: '$label: $value',
        excludeSemantics: true,
        child: Column(
          children: [
            Icon(icon, size: 16, color: t.muted),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: t.muted),
            ),
          ],
        ),
      ),
    );
  }
}

/// A sequência conta dias **sem falha**, e o critério aparece em texto aberto:
/// um contador cujo critério não está à vista é o que faz alguém trabalhar
/// doente com medo de perder um número que não entende.
class _Streak extends StatelessWidget {
  const _Streak({required this.streak});
  final HealthyStreak streak;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final titulo = l10n.perfStreakDays(streak.days);

    return _Banner(
      icon: Icons.local_fire_department_outlined,
      color: t.success,
      title: titulo,
      hint: l10n.perfStreakHint,
    );
  }
}

/// Meta contra a própria média. A barra sozinha não diz nada a quem usa leitor
/// de tela, então o valor vai também como texto semântico.
class _Goal extends StatelessWidget {
  const _Goal({required this.goal});
  final DriverGoal goal;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final atual = (goal.current * 100).round();
    final alvo = (goal.target * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.flag_outlined, size: 16, color: t.accent),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                l10n.perfGoal,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              '$atual% / $alvo%',
              style: TextStyle(fontSize: 11.5, color: t.muted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Semantics(
          label: l10n.perfGoalSemantics(atual, alvo),
          excludeSemantics: true,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (atual / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: t.muted.withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation<Color>(
                goal.met ? t.success : t.accent,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          goal.met ? l10n.perfGoalMet : l10n.perfGoalHint,
          style: TextStyle(fontSize: 11.5, color: t.muted),
        ),
      ],
    );
  }
}

class _RestAdvice extends StatelessWidget {
  const _RestAdvice({required this.minutes});
  final int minutes;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);

    return _Banner(
      icon: Icons.free_breakfast_outlined,
      color: t.warning,
      title: l10n.perfRestTitle(minutes ~/ 60),
      hint: l10n.perfRestHint,
      // Anúncio educado: o aviso de pausa é um cuidado, não uma emergência —
      // interromper a leitura em curso seria pior que esperar a próxima pausa.
      liveRegion: true,
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.color,
    required this.title,
    required this.hint,
    this.liveRegion = false,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String hint;
  final bool liveRegion;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      liveRegion: liveRegion,
      label: '$title. $hint',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(hint, style: TextStyle(fontSize: 11.5, color: t.muted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
