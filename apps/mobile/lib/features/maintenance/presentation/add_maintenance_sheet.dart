import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/gen/app_localizations.dart';
import '../domain/maintenance_models.dart';
import 'maintenance_labels.dart';

/// Sheet para adicionar um registro de manutenção. Devolve [NewMaintenanceRecord]
/// ao salvar, ou null se cancelar.
Future<NewMaintenanceRecord?> showAddMaintenanceSheet(BuildContext context) {
  return showModalBottomSheet<NewMaintenanceRecord>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _AddMaintenanceSheet(),
  );
}

const _types = ['oil_change', 'revision', 'tires', 'insurance', 'inspection', 'ipo', 'other'];

class _AddMaintenanceSheet extends StatefulWidget {
  const _AddMaintenanceSheet();

  @override
  State<_AddMaintenanceSheet> createState() => _AddMaintenanceSheetState();
}

class _AddMaintenanceSheetState extends State<_AddMaintenanceSheet> {
  String _type = 'oil_change';
  DateTime _performedAt = DateTime.now();
  DateTime? _nextDueDate;
  final _odometer = TextEditingController();
  final _cost = TextEditingController();
  final _nextDueKm = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _odometer.dispose();
    _cost.dispose();
    _nextDueKm.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _iso(DateTime d) => d.toIso8601String().substring(0, 10);
  int? _int(TextEditingController c) => int.tryParse(c.text.trim());
  double? _num(TextEditingController c) => double.tryParse(c.text.trim().replaceAll(',', '.'));

  Future<void> _pickPerformed() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _performedAt,
      firstDate: DateTime(2015),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _performedAt = picked);
  }

  Future<void> _pickNextDue() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _nextDueDate ?? DateTime.now().add(const Duration(days: 180)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _nextDueDate = picked);
  }

  void _save() {
    Navigator.of(context).pop(NewMaintenanceRecord(
      type: _type,
      performedAt: _iso(_performedAt),
      odometerKm: _int(_odometer),
      cost: _num(_cost),
      notes: _notes.text,
      nextDueDate: _nextDueDate == null ? null : _iso(_nextDueDate!),
      nextDueOdometerKm: _int(_nextDueKm),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.maintAddTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: InputDecoration(labelText: l10n.maintType, border: const OutlineInputBorder()),
              items: _types
                  .map((t) => DropdownMenuItem(value: t, child: Text(maintenanceTypeLabel(l10n, t))))
                  .toList(),
              onChanged: (v) => setState(() => _type = v ?? _type),
            ),
            const SizedBox(height: 12),
            _DateField(label: l10n.maintPerformedAt, value: _iso(_performedAt), onTap: _pickPerformed),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _NumField(controller: _odometer, label: l10n.maintOdometer, suffix: 'km')),
              const SizedBox(width: 12),
              Expanded(child: _NumField(controller: _cost, label: l10n.maintCost, prefix: '€ ', decimal: true)),
            ]),
            const SizedBox(height: 20),
            Text(l10n.maintNextDue, style: TextStyle(fontSize: 12.5, color: Theme.of(context).hintColor)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: _DateField(
                  label: l10n.maintNextDueDate,
                  value: _nextDueDate == null ? '—' : _iso(_nextDueDate!),
                  onTap: _pickNextDue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: _NumField(controller: _nextDueKm, label: l10n.maintNextDueKm, suffix: 'km')),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: _notes,
              maxLength: 500,
              decoration: InputDecoration(labelText: l10n.maintNotes, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _save,
                style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
                child: Text(l10n.maintSave),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap});
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
        ),
        child: Text(value),
      ),
    );
  }
}

class _NumField extends StatelessWidget {
  const _NumField({required this.controller, required this.label, this.suffix, this.prefix, this.decimal = false});
  final TextEditingController controller;
  final String label;
  final String? suffix;
  final String? prefix;
  final bool decimal;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(decimal ? r'[0-9.,]' : r'[0-9]'))],
      decoration: InputDecoration(
        labelText: label,
        suffixText: suffix,
        prefixText: prefix,
        border: const OutlineInputBorder(),
      ),
    );
  }
}
