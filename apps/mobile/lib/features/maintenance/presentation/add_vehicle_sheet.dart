import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/gen/app_localizations.dart';
import '../domain/maintenance_models.dart';

Future<NewVehicle?> showAddVehicleSheet(BuildContext context) {
  return showModalBottomSheet<NewVehicle>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _AddVehicleSheet(),
  );
}

const _vehicleTypes = ['car', 'van', 'truck', 'motorcycle', 'bicycle'];

class _AddVehicleSheet extends StatefulWidget {
  const _AddVehicleSheet();

  @override
  State<_AddVehicleSheet> createState() => _AddVehicleSheetState();
}

class _AddVehicleSheetState extends State<_AddVehicleSheet> {
  final _formKey = GlobalKey<FormState>();
  final _plate = TextEditingController();
  final _capacity = TextEditingController();
  final _odometer = TextEditingController();
  String _type = 'car';

  @override
  void dispose() {
    _plate.dispose();
    _capacity.dispose();
    _odometer.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(
      NewVehicle(
        plate: _plate.text,
        type: _type,
        capacity: int.parse(_capacity.text.trim()),
        odometerKm: _odometer.text.trim().isEmpty
            ? null
            : int.parse(_odometer.text.trim()),
      ),
    );
  }

  String _typeLabel(AppLocalizations l10n, String type) => switch (type) {
        'van' => l10n.vehicleTypeVan,
        'truck' => l10n.vehicleTypeTruck,
        'motorcycle' => l10n.vehicleTypeMotorcycle,
        'bicycle' => l10n.vehicleTypeBicycle,
        _ => l10n.vehicleTypeCar,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.vehicleAddTitle,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _plate,
                autofocus: true,
                maxLength: 20,
                textCapitalization: TextCapitalization.characters,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                    RegExp(r'[a-zA-Z0-9 -]'),
                  ),
                ],
                decoration: InputDecoration(
                  labelText: l10n.vehiclePlate,
                  border: const OutlineInputBorder(),
                ),
                validator: (value) {
                  final length = value?.trim().length ?? 0;
                  return length >= 3 ? null : l10n.vehiclePlateInvalid;
                },
              ),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: InputDecoration(
                  labelText: l10n.vehicleType,
                  border: const OutlineInputBorder(),
                ),
                items: _vehicleTypes
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(_typeLabel(l10n, type)),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _type = value ?? _type),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _capacity,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: l10n.vehicleCapacity,
                  helperText: l10n.vehicleCapacityHint,
                  border: const OutlineInputBorder(),
                ),
                validator: (value) {
                  final parsed = int.tryParse(value?.trim() ?? '');
                  return parsed != null && parsed > 0
                      ? null
                      : l10n.vehicleCapacityInvalid;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _odometer,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: l10n.vehicleOdometerOptional,
                  suffixText: 'km',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _save,
                  icon: const Icon(Icons.add_road_outlined),
                  label: Text(l10n.vehicleSave),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 50),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
