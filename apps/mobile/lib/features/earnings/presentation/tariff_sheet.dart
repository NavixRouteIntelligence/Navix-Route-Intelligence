import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/gen/app_localizations.dart';
import '../domain/driver_tariff.dart';

/// Sheet para configurar a tarifa (€/entrega e €/km). Devolve a nova [DriverTariff]
/// ao salvar, ou null se cancelar.
Future<DriverTariff?> showTariffSheet(BuildContext context, DriverTariff current) {
  return showModalBottomSheet<DriverTariff>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _TariffSheet(current: current),
  );
}

class _TariffSheet extends StatefulWidget {
  const _TariffSheet({required this.current});
  final DriverTariff current;

  @override
  State<_TariffSheet> createState() => _TariffSheetState();
}

class _TariffSheetState extends State<_TariffSheet> {
  late final TextEditingController _perDelivery =
      TextEditingController(text: widget.current.perDelivery > 0 ? _fmt(widget.current.perDelivery) : '');
  late final TextEditingController _perKm =
      TextEditingController(text: widget.current.perKm > 0 ? _fmt(widget.current.perKm) : '');

  String _fmt(double v) => v.toStringAsFixed(2);

  double _parse(TextEditingController c) =>
      double.tryParse(c.text.trim().replaceAll(',', '.')) ?? 0;

  @override
  void dispose() {
    _perDelivery.dispose();
    _perKm.dispose();
    super.dispose();
  }

  void _save() {
    Navigator.of(context).pop(
      DriverTariff(perDelivery: _parse(_perDelivery), perKm: _parse(_perKm)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.earningsTariffTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(l10n.earningsTariffHint, style: TextStyle(fontSize: 12.5, color: Theme.of(context).hintColor)),
          const SizedBox(height: 16),
          _Field(controller: _perDelivery, label: l10n.earningsPerDelivery),
          const SizedBox(height: 12),
          _Field(controller: _perKm, label: l10n.earningsPerKm),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _save,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
              child: Text(l10n.earningsSave),
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.label});
  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
      decoration: InputDecoration(
        labelText: label,
        prefixText: '€ ',
        border: const OutlineInputBorder(),
      ),
    );
  }
}
