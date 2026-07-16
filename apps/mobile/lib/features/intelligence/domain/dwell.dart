/// Teto de tempo de atendimento aceito pela API (min).
const double maxDwellMinutes = 600;

/// Tempo de permanência (dwell) numa parada, em minutos, entre [start] e [now].
/// Limitado a [0, maxDwellMinutes] e arredondado a 1 casa — vira uma observação
/// `service_time` da inteligência coletiva (ADR-0031/0038).
double dwellMinutes(DateTime start, DateTime now) {
  final minutes = now.difference(start).inMilliseconds / 60000;
  final clamped = minutes.clamp(0, maxDwellMinutes).toDouble();
  return (clamped * 10).round() / 10;
}
