import 'package:equatable/equatable.dart';

/// Parada editável na tela de ordem manual (RSE-2b). Carrega as coordenadas —
/// necessárias para o envio inline (`stops`) que suporta ordem manual e travas
/// (o caminho `deliveryIds` não aceita `locked`). `locked` fixa a posição.
class EditableStop extends Equatable {
  const EditableStop({
    required this.id,
    required this.label,
    required this.cityLine,
    required this.latitude,
    required this.longitude,
    required this.priority,
    this.locked = false,
  });

  final String id;
  final String label; // rua, número (ou cidade se sem rua)
  final String cityLine;
  final double latitude;
  final double longitude;
  final String priority; // low | normal | high | urgent
  final bool locked;

  EditableStop copyWith({bool? locked}) => EditableStop(
        id: id,
        label: label,
        cityLine: cityLine,
        latitude: latitude,
        longitude: longitude,
        priority: priority,
        locked: locked ?? this.locked,
      );

  /// Corpo inline enviado ao `/route-plans[/mine]` (contrato OptimizationStopInput).
  Map<String, dynamic> toStopJson() => {
        'id': id,
        'latitude': latitude,
        'longitude': longitude,
        'priority': priority,
        if (locked) 'locked': true,
      };

  @override
  List<Object?> get props => [id, label, cityLine, latitude, longitude, priority, locked];
}
