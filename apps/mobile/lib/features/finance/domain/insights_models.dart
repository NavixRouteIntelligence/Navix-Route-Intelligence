import 'package:equatable/equatable.dart';

/// Volume de entregas por cidade / por hora (FASE 3, F2).
class RegionStat extends Equatable {
  const RegionStat({required this.city, required this.deliveries});
  final String city;
  final int deliveries;

  factory RegionStat.fromJson(Map<String, dynamic> j) => RegionStat(
        city: (j['city'] as String?) ?? '',
        deliveries: (j['deliveries'] as num?)?.toInt() ?? 0,
      );

  @override
  List<Object?> get props => [city, deliveries];
}

class HourStat extends Equatable {
  const HourStat({required this.hour, required this.deliveries});
  final int hour;
  final int deliveries;

  factory HourStat.fromJson(Map<String, dynamic> j) => HourStat(
        hour: (j['hour'] as num?)?.toInt() ?? 0,
        deliveries: (j['deliveries'] as num?)?.toInt() ?? 0,
      );

  @override
  List<Object?> get props => [hour, deliveries];
}

/// Padrões de entrega: melhor região e horário do período.
class DeliveryInsights extends Equatable {
  const DeliveryInsights({
    this.totalDelivered = 0,
    this.topRegions = const [],
    this.byHour = const [],
    this.bestRegion,
    this.bestHour,
  });

  final int totalDelivered;
  final List<RegionStat> topRegions;
  final List<HourStat> byHour;
  final String? bestRegion;
  final int? bestHour;

  bool get hasData => totalDelivered > 0;

  factory DeliveryInsights.fromJson(Map<String, dynamic> j) => DeliveryInsights(
        totalDelivered: (j['totalDelivered'] as num?)?.toInt() ?? 0,
        topRegions: (j['topRegions'] as List?)?.whereType<Map<String, dynamic>>().map(RegionStat.fromJson).toList() ?? const [],
        byHour: (j['byHour'] as List?)?.whereType<Map<String, dynamic>>().map(HourStat.fromJson).toList() ?? const [],
        bestRegion: j['bestRegion'] as String?,
        bestHour: (j['bestHour'] as num?)?.toInt(),
      );

  @override
  List<Object?> get props => [totalDelivered, topRegions, byHour, bestRegion, bestHour];
}
