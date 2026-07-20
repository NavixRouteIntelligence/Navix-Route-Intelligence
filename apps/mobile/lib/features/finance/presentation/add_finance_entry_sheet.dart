import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/gen/app_localizations.dart';
import '../domain/finance_models.dart';
import 'finance_labels.dart';

/// Sheet para lançar receita/despesa. Devolve [NewFinancialEntry] ou null.
Future<NewFinancialEntry?> showAddFinanceEntrySheet(BuildContext context) {
  return showModalBottomSheet<NewFinancialEntry>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _AddFinanceEntrySheet(),
  );
}

const _categories = ['fuel', 'maintenance', 'toll', 'delivery', 'other'];

class _AddFinanceEntrySheet extends StatefulWidget {
  const _AddFinanceEntrySheet();

  @override
  State<_AddFinanceEntrySheet> createState() => _AddFinanceEntrySheetState();
}

class _AddFinanceEntrySheetState extends State<_AddFinanceEntrySheet> {
  String _type = 'expense';
  String _category = 'fuel';
  DateTime _occurredAt = DateTime.now();
  final _amount = TextEditingController();
  final _odometer = TextEditingController();
  final _liters = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _odometer.dispose();
    _liters.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _iso(DateTime d) => d.toIso8601String().substring(0, 10);
  int? _int(TextEditingController c) => int.tryParse(c.text.trim());
  double? _num(TextEditingController c) => double.tryParse(c.text.trim().replaceAll(',', '.'));

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _occurredAt,
      firstDate: DateTime(2015),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _occurredAt = picked);
  }

  void _save() {
    final amount = _num(_amount);
    if (amount == null || amount <= 0) return; // valor é obrigatório
    Navigator.of(context).pop(NewFinancialEntry(
      type: _type,
      category: _category,
      amount: amount,
      occurredAt: _iso(_occurredAt),
      odometerKm: _category == 'fuel' ? _int(_odometer) : null,
      liters: _category == 'fuel' ? _num(_liters) : null,
      notes: _notes.text,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final isFuel = _category == 'fuel';
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.finAddTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'expense', label: Text(l10n.finExpense), icon: const Icon(Icons.south_west)),
                ButtonSegment(value: 'income', label: Text(l10n.finIncome), icon: const Icon(Icons.north_east)),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() => _type = s.first),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: InputDecoration(labelText: l10n.finCategory, border: const OutlineInputBorder()),
              items: _categories
                  .map((c) => DropdownMenuItem(value: c, child: Text(financeCategoryLabel(l10n, c))))
                  .toList(),
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _NumField(controller: _amount, label: l10n.finAmount, prefix: '€ ', decimal: true)),
              const SizedBox(width: 12),
              Expanded(child: _DateField(label: l10n.finDate, value: _iso(_occurredAt), onTap: _pickDate)),
            ]),
            if (isFuel) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _NumField(controller: _odometer, label: l10n.finOdometer, suffix: 'km')),
                const SizedBox(width: 12),
                Expanded(child: _NumField(controller: _liters, label: l10n.finLiters, suffix: 'L', decimal: true)),
              ]),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _notes,
              maxLength: 500,
              decoration: InputDecoration(labelText: l10n.finNotes, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _save,
                style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
                child: Text(l10n.finSave),
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
