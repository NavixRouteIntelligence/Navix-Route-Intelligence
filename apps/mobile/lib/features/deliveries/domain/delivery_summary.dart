import 'package:equatable/equatable.dart';

/// Status de uma entrega (espelha o contrato do backend).
enum DeliveryStatusView { pending, inRoute, delivered, failed, unknown }

/// Prioridade de uma entrega.
enum DeliveryPriorityView { low, normal, high, urgent, unknown }

/// Resumo de uma entrega para a lista da Empresa. Somente os campos que a
/// listagem precisa — o detalhe carrega o restante sob demanda.
class DeliverySummary extends Equatable {
  const DeliverySummary({
    required this.id,
    required this.addressLine,
    required this.city,
    required this.status,
    required this.priority,
    required this.windowStart,
    required this.windowEnd,
    required this.notes,
  });

  final String id;
  final String addressLine;
  final String city;
  final DeliveryStatusView status;
  final DeliveryPriorityView priority;
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final String? notes;

  factory DeliverySummary.fromJson(Map<String, dynamic> json) {
    final address = json['address'];
    final addr = address is Map<String, dynamic> ? address : const <String, dynamic>{};
    final window = json['timeWindow'];
    final win = window is Map<String, dynamic> ? window : const <String, dynamic>{};
    final street = (addr['street'] as String?)?.trim() ?? '';
    final number = (addr['number'] as String?)?.trim() ?? '';

    return DeliverySummary(
      id: (json['id'] as String?) ?? '',
      addressLine: [street, number].where((s) => s.isNotEmpty).join(', '),
      city: (addr['city'] as String?) ?? '',
      status: _status(json['status'] as String?),
      priority: _priority(json['priority'] as String?),
      windowStart: DateTime.tryParse((win['start'] as String?) ?? '')?.toLocal(),
      windowEnd: DateTime.tryParse((win['end'] as String?) ?? '')?.toLocal(),
      notes: (json['notes'] as String?)?.trim().isEmpty ?? true ? null : json['notes'] as String?,
    );
  }

  static DeliveryStatusView _status(String? raw) => switch (raw) {
        'pending' => DeliveryStatusView.pending,
        'in_route' => DeliveryStatusView.inRoute,
        'delivered' => DeliveryStatusView.delivered,
        'failed' => DeliveryStatusView.failed,
        _ => DeliveryStatusView.unknown,
      };

  static DeliveryPriorityView _priority(String? raw) => switch (raw) {
        'low' => DeliveryPriorityView.low,
        'normal' => DeliveryPriorityView.normal,
        'high' => DeliveryPriorityView.high,
        'urgent' => DeliveryPriorityView.urgent,
        _ => DeliveryPriorityView.unknown,
      };

  @override
  List<Object?> get props => [id, addressLine, city, status, priority, windowStart, windowEnd, notes];
}
