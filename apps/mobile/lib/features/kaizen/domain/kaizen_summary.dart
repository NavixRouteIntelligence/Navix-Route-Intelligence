import '../../../l10n/gen/app_localizations.dart';

/// Composição do resumo diário em blocos (secção 1 do contrato de linguagem).
///
/// Função pura: recebe o payload de `GET /me/kaizen/daily` e as strings, e
/// devolve os blocos já escritos. Não sabe desenhar nada — é aqui que a
/// secção 1 deixa de ser orientação e passa a ser código: a ordem dos blocos e
/// **quais aparecem** são decididos uma vez, e não em cada ecrã que consuma o
/// resumo.
///
/// A regra que mais importa é a de omissão: um bloco sem dado **não aparece**.
/// Um «—» ou um «0» no lugar da comparação seria pior do que nada, porque
/// parece um facto.
enum KaizenBlockKind { yesterday, comparison, why, today }

class KaizenBlock {
  const KaizenBlock(this.kind, this.title, this.body);

  final KaizenBlockKind kind;
  final String title;
  final String body;

  @override
  String toString() => '$title\n$body';
}

/// O payload, no mínimo que a composição precisa de saber.
class KaizenDaily {
  const KaizenDaily({
    required this.day,
    required this.status,
    required this.delivered,
    required this.failed,
    required this.onTime,
    this.baselineDelivered,
    this.baselineSample = 0,
    this.baselineTrend,
    this.recommendationCode,
    this.recommendationCount,
    this.recommendationKm,
    this.recommendationDuration,
    this.recommendationBaselineDuration,
  });

  factory KaizenDaily.fromJson(Map<String, dynamic> json) {
    final metrics = (json['metrics'] as Map<String, dynamic>?) ?? const {};
    final baseline = (json['baseline'] as Map<String, dynamic>?);
    final delivered = (baseline?['delivered'] as Map<String, dynamic>?);
    final rec = (json['recommendation'] as Map<String, dynamic>?);
    final action = (rec?['action'] as Map<String, dynamic>?);
    final evidence = ((rec?['evidence'] as List<dynamic>?) ?? const [])
        .cast<Map<String, dynamic>>();

    num? evidenceOf(String metric) => evidence
        .cast<Map<String, dynamic>?>()
        .firstWhere((e) => e?['metric'] == metric,
            orElse: () => null)?['value'] as num?;
    num? baselineOf(String metric) => evidence
        .cast<Map<String, dynamic>?>()
        .firstWhere((e) => e?['metric'] == metric,
            orElse: () => null)?['baseline'] as num?;

    return KaizenDaily(
      day: json['day'] as String,
      status: json['status'] as String,
      delivered: (metrics['delivered'] as num?)?.toInt() ?? 0,
      failed: (metrics['failed'] as num?)?.toInt() ?? 0,
      onTime: (metrics['onTime'] as num?)?.toInt() ?? 0,
      baselineDelivered: (delivered?['baseline'] as num?)?.toDouble(),
      baselineSample: (delivered?['sample'] as num?)?.toInt() ?? 0,
      baselineTrend: delivered?['trend'] as String?,
      recommendationCode: rec?['code'] as String?,
      recommendationCount: (action?['count'] as num?)?.toInt(),
      recommendationKm: evidenceOf('savedKm')?.toDouble(),
      recommendationDuration: evidenceOf('activeMinutes')?.toInt(),
      recommendationBaselineDuration: baselineOf('activeMinutes')?.toInt(),
    );
  }

  final String day;
  final String status;
  final int delivered;
  final int failed;
  final int onTime;
  final double? baselineDelivered;
  final int baselineSample;
  final String? baselineTrend;
  final String? recommendationCode;
  final int? recommendationCount;
  final double? recommendationKm;
  final int? recommendationDuration;
  final int? recommendationBaselineDuration;
}

/// Escreve o resumo em blocos, na ordem da secção 1.
List<KaizenBlock> composeKaizenSummary(
    KaizenDaily daily, AppLocalizations l10n) {
  // Projeção pendente: um bloco só, e honesto. Mostrar zeros aqui seria
  // apresentar ausência de dado como dia vazio.
  if (daily.status == 'pending') {
    return [
      KaizenBlock(KaizenBlockKind.yesterday, l10n.kaizenSectionYesterday,
          l10n.kaizenPreparing),
    ];
  }

  // Dia de folga: um bloco, e mais nada. Sem «que tal recomeçar hoje», sem
  // contagem de dias parados.
  if (daily.status == 'no-work') {
    return [
      KaizenBlock(KaizenBlockKind.yesterday, l10n.kaizenSectionYesterday,
          l10n.kaizenTitleNoWork),
    ];
  }

  // Sem referência não se inventa um resumo de um dia isolado.
  final semHistorico = daily.baselineTrend == null ||
      daily.baselineTrend == 'building-history' ||
      daily.baselineDelivered == null;
  if (semHistorico) {
    return [
      KaizenBlock(
        KaizenBlockKind.yesterday,
        l10n.kaizenSectionYesterday,
        l10n.kaizenWhyBuildingHistory,
      ),
    ];
  }

  return [
    KaizenBlock(KaizenBlockKind.yesterday, l10n.kaizenSectionYesterday,
        _ontem(daily, l10n)),
    KaizenBlock(KaizenBlockKind.comparison, l10n.kaizenSectionComparison,
        _comparacao(daily, l10n)),
    KaizenBlock(
        KaizenBlockKind.why, l10n.kaizenSectionWhy, _porque(daily, l10n)),
    KaizenBlock(
        KaizenBlockKind.today, l10n.kaizenSectionToday, _hoje(daily, l10n)),
  ];
}

String _ontem(KaizenDaily d, AppLocalizations l10n) {
  if (d.failed > 0)
    return l10n.kaizenYesterdayWithPending(d.delivered, d.failed);
  if (d.delivered > 0 && d.onTime == d.delivered) {
    return l10n.kaizenYesterdayAllInWindow(d.delivered);
  }
  return l10n.kaizenYesterdayCompleted(d.delivered);
}

String _comparacao(KaizenDaily d, AppLocalizations l10n) {
  final base = d.baselineDelivered!;
  final texto = base == base.roundToDouble()
      ? base.round().toString()
      : base.toStringAsFixed(1).replaceAll('.', ',');
  return l10n.kaizenComparisonUsual(
      d.baselineSample, texto, _tendencia(d.baselineTrend!, l10n));
}

String _tendencia(String trend, AppLocalizations l10n) => switch (trend) {
      'improved' => l10n.kaizenTrendImproved,
      'attention' => l10n.kaizenTrendAttention,
      'building-history' => l10n.kaizenTrendBuildingHistory,
      _ => l10n.kaizenTrendStable,
    };

/// O «porquê» só existe quando o motor tem evidência. Sem ela, diz-se que não
/// se sabe — nunca se constrói uma explicação plausível.
String _porque(KaizenDaily d, AppLocalizations l10n) =>
    switch (d.recommendationCode) {
      'rest.long-day' =>
        l10n.kaizenWhyRestLongDay(_duracao(d.recommendationDuration, l10n)),
      'rest.longer-than-usual' => l10n.kaizenWhyRestLongerThanUsual(
          _duracao(d.recommendationDuration, l10n),
          _duracao(d.recommendationBaselineDuration, l10n),
        ),
      'failures.first' => l10n.kaizenWhyFailuresFirst,
      'failures.repeated' =>
        l10n.kaizenWhyFailuresRepeated(d.recommendationCount ?? d.failed),
      'load.follow-suggested-order' =>
        l10n.kaizenWhyLoadOrder(_km(d.recommendationKm)),
      'none.acknowledge' => l10n.kaizenWhyAcknowledge(d.delivered),
      _ => l10n.kaizenWhyUnknown,
    };

/// Uma ação, ou nenhuma. Sugerir algo só para não vir vazio é como se aprende
/// a fechar o resumo sem ler.
String _hoje(KaizenDaily d, AppLocalizations l10n) =>
    switch (d.recommendationCode) {
      'rest.long-day' ||
      'rest.longer-than-usual' =>
        l10n.kaizenActionPlanShorterDay,
      'failures.first' || 'failures.repeated' => l10n.kaizenActionReviewFailed,
      'load.follow-suggested-order' => l10n.kaizenActionLoadInRouteOrder,
      _ => l10n.kaizenNothingToSuggest,
    };

String _duracao(int? minutos, AppLocalizations l10n) {
  if (minutos == null) return '—';
  final h = minutos ~/ 60;
  final m = minutos % 60;
  return h > 0 ? '${h}h${m.toString().padLeft(2, '0')}' : '${m}min';
}

/// Distância sempre como **diferença face à ordem de origem**, nunca como
/// poupança realizada (secção 5): ninguém conduziu a alternativa.
String _km(double? km) =>
    km == null ? '—' : km.toStringAsFixed(1).replaceAll('.', ',');
