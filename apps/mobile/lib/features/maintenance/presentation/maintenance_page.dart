import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/shell/adaptive_nav_scaffold.dart';
import '../../../app/theme/navix_tokens.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_states.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/maintenance_models.dart';
import 'add_maintenance_sheet.dart';
import 'add_vehicle_sheet.dart';
import 'maintenance_cubit.dart';
import 'maintenance_labels.dart';

/// Área única do veículo: resumo operacional e manutenção na mesma tela.
class MaintenancePage extends StatelessWidget {
  const MaintenancePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => GetIt.instance<MaintenanceCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(
          leading: const NavLeading(),
          title: Text(l10n.vehicleTitle),
        ),
        body: BlocConsumer<MaintenanceCubit, MaintenanceState>(
          listenWhen: (p, c) => p.error != c.error && c.error != null,
          listener: (context, state) => ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(content: Text(context.failureText(state.error!))),
            ),
          builder: (context, state) {
            return switch (state.status) {
              MaintenanceStatus.loading => const Center(
                  child: CircularProgressIndicator(),
                ),
              MaintenanceStatus.error => NavixErrorState(
                  description: state.error == null
                      ? l10n.maintLoadError
                      : context.failureText(state.error!),
                  onRetry: () => context.read<MaintenanceCubit>().load(),
                ),
              MaintenanceStatus.empty => state.busy
                  ? const Center(child: CircularProgressIndicator())
                  : NavixEmptyState(
                      icon: Icons.directions_car_outlined,
                      title: l10n.maintNoVehicleTitle,
                      description: l10n.maintNoVehicleDesc,
                      actionLabel: l10n.vehicleAdd,
                      onAction: () => _create(context),
                    ),
              MaintenanceStatus.ready => _Content(
                  state: state,
                  onAddRecord: () => _add(context),
                ),
            };
          },
        ),
        floatingActionButton: BlocBuilder<MaintenanceCubit, MaintenanceState>(
          builder: (context, state) {
            if (state.status != MaintenanceStatus.ready) {
              return const SizedBox.shrink();
            }
            return FloatingActionButton.extended(
              heroTag: 'fab-maintenance',
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

  Future<void> _create(BuildContext context) async {
    final cubit = context.read<MaintenanceCubit>();
    final vehicle = await showAddVehicleSheet(context);
    if (vehicle != null && context.mounted) {
      await cubit.createVehicle(vehicle);
    }
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state, required this.onAddRecord});
  final MaintenanceState state;
  final VoidCallback onAddRecord;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () => context.read<MaintenanceCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          _VehicleCard(vehicle: state.vehicle!),
          const SizedBox(height: 20),
          _MaintenanceAssistantCard(state: state),
          const SizedBox(height: 20),
          NavixSectionHeader(
            title: l10n.maintNextMaintenance,
            icon: Icons.event_available_outlined,
          ),
          const SizedBox(height: 8),
          if (state.reminders.isEmpty)
            _MaintenanceSetupCard(onPressed: onAddRecord)
          else ...[
            ...state.reminders.map((r) => _ReminderTile(reminder: r)),
          ],
          const SizedBox(height: 20),
          NavixSectionHeader(title: l10n.maintHistory, icon: Icons.history),
          if (state.records.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                l10n.maintNoRecords,
                textAlign: TextAlign.center,
                style: TextStyle(color: context.tokens.muted),
              ),
            )
          else
            ...state.records.map((rec) => _RecordTile(record: rec)),
        ],
      ),
    );
  }
}

class _MaintenanceAssistantCard extends StatelessWidget {
  const _MaintenanceAssistantCard({required this.state});

  final MaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    final overdue = state.reminders.where((item) => item.isOverdue).length;
    final dueSoon = state.reminders.where((item) => item.isDueSoon).length;

    final (title, description, status, color) = state.records.isEmpty
        ? (
            l10n.maintAssistantNeedsDataTitle,
            l10n.maintAssistantNeedsDataDescription,
            l10n.maintAssistantLowConfidence,
            t.muted,
          )
        : overdue > 0
            ? (
                l10n.maintAssistantOverdueTitle,
                l10n.maintAssistantOverdueDescription,
                l10n.maintStatusOverdue,
                t.danger,
              )
            : dueSoon > 0
                ? (
                    l10n.maintAssistantPlanTitle,
                    l10n.maintAssistantPlanDescription,
                    l10n.maintStatusDueSoon,
                    t.warning,
                  )
                : state.reminders.isEmpty
                    ? (
                        l10n.maintAssistantNoDeadlineTitle,
                        l10n.maintAssistantNoDeadlineDescription,
                        l10n.maintAssistantLowConfidence,
                        t.muted,
                      )
                    : (
                        l10n.maintAssistantOkTitle,
                        l10n.maintAssistantOkDescription,
                        l10n.maintStatusOk,
                        t.success,
                      );

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            scheme.primary.withValues(alpha: 0.18),
            t.accent.withValues(alpha: 0.06),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.auto_awesome_outlined,
                  size: 21,
                  color: scheme.primary,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.maintAssistantTitle,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    NavixStatusPill(label: status, color: color),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            description,
            style: TextStyle(fontSize: 13.5, height: 1.4, color: t.muted),
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              Icon(Icons.info_outline, size: 16, color: t.accent),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  l10n.maintAssistantExplanation,
                  style: TextStyle(fontSize: 12, color: t.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MaintenanceSetupCard extends StatelessWidget {
  const _MaintenanceSetupCard({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    return NavixCard(
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: t.accent.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.fact_check_outlined, color: t.accent),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.maintNoDeadlinesTitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 5),
          Text(
            l10n.maintNoDeadlinesDescription,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.4, color: t.muted),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.add),
              label: Text(l10n.maintConfigure),
            ),
          ),
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
    final statusColor = switch (vehicle.status) {
      'maintenance' => t.warning,
      'inactive' => t.muted,
      _ => t.success,
    };
    return NavixCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  _vehicleIcon(vehicle.type),
                  color: Theme.of(context).colorScheme.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vehicle.plate,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _vehicleTypeLabel(l10n, vehicle.type),
                      style: TextStyle(fontSize: 13, color: t.muted),
                    ),
                  ],
                ),
              ),
              NavixStatusPill(
                label: _vehicleStatusLabel(l10n, vehicle.status),
                color: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Divider(height: 1, color: t.line),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _VehicleMetric(
                  icon: Icons.speed_outlined,
                  label: l10n.maintOdometer,
                  value: vehicle.odometerKm != null
                      ? '${vehicle.odometerKm} km'
                      : l10n.maintOdometerUnset,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _VehicleMetric(
                  icon: Icons.inventory_2_outlined,
                  label: l10n.vehicleCapacity,
                  value: vehicle.capacity > 0
                      ? vehicle.capacity.toString()
                      : l10n.vehicleNotInformed,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => _editOdometer(context, vehicle.odometerKm),
            icon: const Icon(Icons.edit_road_outlined, size: 18),
            label: Text(l10n.maintUpdateOdometer),
          ),
        ],
      ),
    );
  }

  IconData _vehicleIcon(String type) => switch (type) {
        'truck' => Icons.local_shipping_outlined,
        'motorcycle' => Icons.two_wheeler_outlined,
        'bicycle' => Icons.pedal_bike_outlined,
        _ => Icons.directions_car_outlined,
      };

  String _vehicleTypeLabel(AppLocalizations l10n, String type) =>
      switch (type) {
        'van' => l10n.vehicleTypeVan,
        'truck' => l10n.vehicleTypeTruck,
        'motorcycle' => l10n.vehicleTypeMotorcycle,
        'bicycle' => l10n.vehicleTypeBicycle,
        _ => l10n.vehicleTypeCar,
      };

  String _vehicleStatusLabel(AppLocalizations l10n, String status) =>
      switch (status) {
        'maintenance' => l10n.vehicleStatusMaintenance,
        'inactive' => l10n.vehicleStatusInactive,
        _ => l10n.vehicleStatusActive,
      };

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
          decoration: InputDecoration(
            labelText: l10n.maintOdometer,
            suffixText: 'km',
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(ctx, int.tryParse(controller.text.trim())),
            child: Text(l10n.maintSave),
          ),
        ],
      ),
    );
    if (value != null) await cubit.updateOdometer(value);
  }
}

class _VehicleMetric extends StatelessWidget {
  const _VehicleMetric({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 17, color: t.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: t.muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
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
      if (reminder.remainingDays != null)
        l10n.maintNDays(reminder.remainingDays!.abs()),
      if (reminder.remainingKm != null)
        l10n.maintNKm(reminder.remainingKm!.abs()),
    ];
    final timingLabel = reminder.isOverdue
        ? l10n.maintOverduePrefix
        : l10n.maintRemainingPrefix;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NavixCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(
                _maintenanceIcon(reminder.type),
                color: color,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    maintenanceTypeLabel(l10n, reminder.type),
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (parts.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      '$timingLabel: ${parts.join(' · ')}',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: reminder.isOverdue ? color : t.muted,
                        fontWeight: reminder.isOverdue
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ],
                  const SizedBox(height: 3),
                  Text(
                    l10n.maintBasedOnDeadline,
                    style: TextStyle(fontSize: 11.5, color: t.muted),
                  ),
                ],
              ),
            ),
            NavixStatusPill(label: label, color: color),
          ],
        ),
      ),
    );
  }

  IconData _maintenanceIcon(String type) => switch (type) {
        'oil_change' => Icons.oil_barrel_outlined,
        'tires' => Icons.tire_repair_outlined,
        'insurance' => Icons.shield_outlined,
        'inspection' || 'ipo' => Icons.fact_check_outlined,
        'revision' => Icons.build_circle_outlined,
        _ => Icons.handyman_outlined,
      };
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
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.check, size: 20, color: t.accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    maintenanceTypeLabel(l10n, record.type),
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    meta.join(' · '),
                    style: TextStyle(fontSize: 12, color: t.muted),
                  ),
                  if (record.notes != null && record.notes!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      record.notes!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: t.muted),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              tooltip: l10n.maintDelete,
              onPressed: () =>
                  context.read<MaintenanceCubit>().deleteRecord(record.id),
              icon: Icon(Icons.delete_outline, size: 20, color: t.muted),
            ),
          ],
        ),
      ),
    );
  }
}
