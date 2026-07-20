import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/maintenance_models.dart';
import 'add_maintenance_sheet.dart';
import 'maintenance_cubit.dart';
import 'maintenance_labels.dart';

/// Tela de manutenção do veículo (FASE 3, V3): hodômetro, lembretes de
/// vencimento (com badges de urgência) e histórico de registros.
class MaintenancePage extends StatelessWidget {
  const MaintenancePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<MaintenanceCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.maintTitle)),
        body: BlocConsumer<MaintenanceCubit, MaintenanceState>(
          listenWhen: (p, c) => p.error != c.error && c.error != null,
          listener: (context, state) => ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(state.error!))),
          builder: (context, state) {
            return switch (state.status) {
              MaintenanceStatus.loading => const Center(child: CircularProgressIndicator()),
              MaintenanceStatus.error => NavixErrorState(
                  description: state.error ?? l10n.maintLoadError,
                  onRetry: () => context.read<MaintenanceCubit>().load(),
                ),
              MaintenanceStatus.empty => NavixEmptyState(
                  icon: Icons.directions_car_outlined,
                  title: l10n.maintNoVehicleTitle,
                  description: l10n.maintNoVehicleDesc,
                ),
              MaintenanceStatus.ready => _Content(state: state),
            };
          },
        ),
        floatingActionButton: BlocBuilder<MaintenanceCubit, MaintenanceState>(
          builder: (context, state) {
            if (state.status != MaintenanceStatus.ready) return const SizedBox.shrink();
            return FloatingActionButton.extended(
              onPressed: state.busy ? null : () => _add(context),
              icon: const Icon(Icons.add),
              label: Text(l10n.maintAddTitle),
            );
          },
        ),
      ),
    );
  }

  Future<void> _add(BuildContext context) async {
    final cubit = context.read<MaintenanceCubit>();
    final record = await showAddMaintenanceSheet(context);
    if (record != null) await cubit.addRecord(record);
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state});
  final MaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () => context.read<MaintenanceCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          _VehicleCard(vehicle: state.vehicle!),
          const SizedBox(height: 12),
          if (state.reminders.isNotEmpty) ...[
            NavixSectionHeader(title: l10n.maintReminders, icon: Icons.notifications_active_outlined),
            ...state.reminders.map((r) => _ReminderTile(reminder: r)),
            const SizedBox(height: 12),
          ],
          NavixSectionHeader(title: l10n.maintHistory, icon: Icons.history),
          if (state.records.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(l10n.maintNoRecords, textAlign: TextAlign.center, style: TextStyle(color: context.tokens.muted)),
            )
          else
            ...state.records.map((rec) => _RecordTile(record: rec)),
        ],
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard({required this.vehicle});
  final MaintenanceVehicle vehicle;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    return NavixCard(
      child: Row(
        children: [
          CircleAvatar(radius: 22, backgroundColor: Theme.of(context).colorScheme.primary, child: const Icon(Icons.directions_car, color: Colors.white)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vehicle.plate, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  vehicle.odometerKm != null ? '${vehicle.odometerKm} km' : l10n.maintOdometerUnset,
                  style: TextStyle(fontSize: 13, color: t.muted),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => _editOdometer(context, vehicle.odometerKm),
            icon: const Icon(Icons.speed_outlined, size: 18),
            label: Text(l10n.maintUpdateOdometer),
          ),
        ],
      ),
    );
  }

  Future<void> _editOdometer(BuildContext context, int? current) async {
    final cubit = context.read<MaintenanceCubit>();
    final l10n = AppLocalizations.of(context);
    final controller = TextEditingController(text: current?.toString() ?? '');
    final value = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.maintUpdateOdometer),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: l10n.maintOdometer, suffixText: 'km', border: const OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.commonCancel)),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, int.tryParse(controller.text.trim())),
            child: Text(l10n.maintSave),
          ),
        ],
      ),
    );
    if (value != null) await cubit.updateOdometer(value);
  }
}

class _ReminderTile extends StatelessWidget {
  const _ReminderTile({required this.reminder});
  final MaintenanceReminder reminder;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final (color, label) = switch (reminder.status) {
      'overdue' => (t.danger, l10n.maintStatusOverdue),
      'due_soon' => (t.warning, l10n.maintStatusDueSoon),
      _ => (t.success, l10n.maintStatusOk),
    };
    final parts = <String>[
      if (reminder.remainingDays != null) l10n.maintNDays(reminder.remainingDays!.abs()),
      if (reminder.remainingKm != null) l10n.maintNKm(reminder.remainingKm!.abs()),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(maintenanceTypeLabel(l10n, reminder.type), style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                  if (parts.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(parts.join(' · '), style: TextStyle(fontSize: 12, color: t.muted)),
                  ],
                ],
              ),
            ),
            NavixStatusPill(label: label, color: color),
          ],
        ),
      ),
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record});
  final MaintenanceRecord record;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l10n = AppLocalizations.of(context);
    final meta = <String>[
      record.performedAt,
      if (record.odometerKm != null) '${record.odometerKm} km',
      if (record.cost != null) '€ ${record.cost!.toStringAsFixed(2)}',
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(maintenanceTypeLabel(l10n, record.type), style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(meta.join(' · '), style: TextStyle(fontSize: 12, color: t.muted)),
                  if (record.notes != null && record.notes!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(record.notes!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.muted)),
                  ],
                ],
              ),
            ),
            IconButton(
              tooltip: l10n.maintDelete,
              onPressed: () => context.read<MaintenanceCubit>().deleteRecord(record.id),
              icon: Icon(Icons.delete_outline, size: 20, color: t.muted),
            ),
          ],
        ),
      ),
    );
  }
}
