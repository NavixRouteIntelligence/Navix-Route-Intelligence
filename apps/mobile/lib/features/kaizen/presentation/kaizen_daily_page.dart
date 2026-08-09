import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_states.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/kaizen_summary.dart';
import 'kaizen_cubit.dart';

/// «O seu dia de ontem» (ADR-0120 / contrato de linguagem).
///
/// ## O que esta tela recusa mostrar
///
/// Nenhuma posição na frota, nenhum score, nenhuma cobrança. A restrição não
/// mora aqui: os textos vêm de chaves guardadas por
/// `test/kaizen_language_contract_test.dart`, e a estrutura dos blocos vem de
/// `composeKaizenSummary`. O layout pode mudar sem que nada disso se perca —
/// que é precisamente a razão de não estar no layout.
///
/// A única mensagem que pede uma ação pede para **preparar**, nunca para
/// acelerar.
class KaizenDailyPage extends StatelessWidget {
  const KaizenDailyPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<KaizenCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.kaizenScreenTitle)),
        body: const SafeArea(child: _Body()),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return BlocBuilder<KaizenCubit, KaizenState>(
      builder: (context, state) {
        switch (state.status) {
          case KaizenStatus.loading:
            return const Center(child: CircularProgressIndicator());

          case KaizenStatus.empty:
            return NavixEmptyState(
              icon: Icons.wb_twilight_outlined,
              title: l10n.kaizenEmptyNoRoute,
            );

          // Sem rede não há nada partido: não se oferece «tentar de novo», que
          // seria pedir uma ação que não pode resultar.
          case KaizenStatus.offline:
            return NavixEmptyState(
              icon: Icons.cloud_off_outlined,
              title: l10n.kaizenOffline,
            );

          case KaizenStatus.error:
            return NavixEmptyState(
              icon: Icons.error_outline,
              title: l10n.kaizenErrorTitle,
              actionLabel: l10n.kaizenRetry,
              onAction: () => context.read<KaizenCubit>().load(),
            );

          case KaizenStatus.ready:
            return _Summary(daily: state.daily!);
        }
      },
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.daily});

  final KaizenDaily daily;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final blocos = composeKaizenSummary(daily, l10n);
    final unico = blocos.length == 1;

    return RefreshIndicator(
      onRefresh: () => context.read<KaizenCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Greeting(day: daily.day, blocos: blocos),
          const SizedBox(height: 16),
          // Um bloco só significa dia de folga, projeção pendente ou histórico
          // a construir. Mostrar cartões de números vazios ao lado disso seria
          // apresentar ausência de dado como resultado.
          if (unico)
            NavixCard(child: Text(blocos.single.body))
          else ...[
            _NumbersCard(daily: daily),
            const SizedBox(height: 16),
            _TrendsCard(daily: daily, blocos: blocos),
            const SizedBox(height: 16),
            _TodayCard(blocos: blocos),
          ],
        ],
      ),
    );
  }
}

/// «Bom dia» às 20h é errado, e o resumo pode ser aberto a qualquer hora.
///
/// Fica fora do widget para poder ser testada sem relógio da máquina: um teste
/// que depende da hora real falha sozinho de madrugada.
String kaizenGreeting(AppLocalizations l10n, DateTime now) {
  if (now.hour < 12) return l10n.kaizenGreetingMorning;
  if (now.hour < 19) return l10n.kaizenGreetingAfternoon;
  return l10n.kaizenGreetingEvening;
}

/// `2026-08-08` é um identificador, não uma data para ler.
String kaizenReadableDay(String day, String locale) {
  final data = DateTime.tryParse(day);
  return data == null ? day : DateFormat.MMMMEEEEd(locale).format(data);
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.day, required this.blocos});

  final String day;
  final List<KaizenBlock> blocos;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final texto = Theme.of(context).textTheme;

    // O leitor de ecrã recebe o resumo inteiro numa leitura: quem usa
    // TalkBack não deve ter de varrer quatro cartões para saber como foi o dia.
    return Semantics(
      label:
          l10n.kaizenSemanticsSummary(day, blocos.map((b) => b.body).join(' ')),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(kaizenGreeting(l10n, DateTime.now()),
              style: texto.headlineSmall),
          const SizedBox(height: 4),
          Text(
            kaizenReadableDay(
                day, Localizations.localeOf(context).toLanguageTag()),
            style: texto.bodyMedium?.copyWith(color: context.tokens.muted),
          ),
        ],
      ),
    );
  }
}

class _NumbersCard extends StatelessWidget {
  const _NumbersCard({required this.daily});

  final KaizenDaily daily;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.kaizenCardNumbers,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          // `Wrap` e não `Row`: com Dynamic Type grande, quatro números lado a
          // lado deixam de caber e passariam a truncar.
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _Stat(
                  label: l10n.kaizenStatDelivered, value: '${daily.delivered}'),
              _Stat(
                label: l10n.kaizenStatSuccess,
                value: _rate(
                    daily.delivered, daily.delivered + daily.failed, l10n),
              ),
              _Stat(
                label: l10n.kaizenStatOnTime,
                value: _rate(daily.onTime, daily.delivered, l10n),
              ),
              if (daily.recommendationKm != null)
                _Stat(
                  label: l10n.kaizenStatShorterRoute,
                  value:
                      '${daily.recommendationKm!.toStringAsFixed(1).replaceAll('.', ',')} km',
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// Sem denominador não há taxa. «0%» seria um facto inventado.
  String _rate(int numerador, int denominador, AppLocalizations l10n) =>
      denominador <= 0
          ? l10n.kaizenValueUnknown
          : '${(numerador / denominador * 100).round()}%';
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Semantics(
      label: '$label: $value',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value, style: texto.headlineSmall),
          Text(label,
              style: texto.bodySmall?.copyWith(color: context.tokens.muted)),
        ],
      ),
    );
  }
}

class _TrendsCard extends StatelessWidget {
  const _TrendsCard({required this.daily, required this.blocos});

  final KaizenDaily daily;
  final List<KaizenBlock> blocos;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final comparacao =
        blocos.firstWhere((b) => b.kind == KaizenBlockKind.comparison).body;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.kaizenCardTrends,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(comparacao),
        ],
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.blocos});

  final List<KaizenBlock> blocos;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final texto = Theme.of(context).textTheme;
    final porque = blocos.firstWhere((b) => b.kind == KaizenBlockKind.why).body;
    final hoje = blocos.firstWhere((b) => b.kind == KaizenBlockKind.today).body;

    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.kaizenCardToday, style: texto.titleMedium),
          const SizedBox(height: 8),
          // A ação primeiro, o motivo a seguir: quem abre o resumo às 7h quer
          // saber o que fazer, e a explicação sustenta — não antecede.
          Text(hoje, style: texto.bodyLarge),
          const SizedBox(height: 12),
          Text(l10n.kaizenSectionWhy, style: texto.labelMedium),
          const SizedBox(height: 4),
          Text(porque,
              style: texto.bodyMedium?.copyWith(color: context.tokens.muted)),
        ],
      ),
    );
  }
}
