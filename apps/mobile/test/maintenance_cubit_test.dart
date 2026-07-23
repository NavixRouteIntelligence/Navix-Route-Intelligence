import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/maintenance/data/maintenance_repository.dart';
import 'package:navix_mobile/features/maintenance/domain/maintenance_models.dart';
import 'package:navix_mobile/features/maintenance/presentation/maintenance_cubit.dart';

class _MockRepo extends Mock implements MaintenanceRepository {}

class _FakeNewRecord extends Fake implements NewMaintenanceRecord {}

void main() {
  late _MockRepo repo;

  const vehicle = MaintenanceVehicle(id: 'v1', plate: 'AA-00-BB', type: 'car', odometerKm: 120000);
  const record = MaintenanceRecord(id: 'm1', type: 'oil_change', performedAt: '2026-07-01');
  const reminder = MaintenanceReminder(type: 'insurance', status: 'due_soon', remainingDays: 16);

  setUpAll(() => registerFallbackValue(_FakeNewRecord()));
  setUp(() => repo = _MockRepo());

  MaintenanceCubit build() => MaintenanceCubit(repo);

  blocTest<MaintenanceCubit, MaintenanceState>(
    'load: sem veículo → empty',
    build: () {
      when(() => repo.myVehicle()).thenAnswer((_) async => null);
      return build();
    },
    act: (c) => c.load(),
    expect: () => const [
      MaintenanceState(status: MaintenanceStatus.loading),
      MaintenanceState(status: MaintenanceStatus.empty),
    ],
  );

  blocTest<MaintenanceCubit, MaintenanceState>(
    'load: com veículo → ready com registros e lembretes',
    build: () {
      when(() => repo.myVehicle()).thenAnswer((_) async => vehicle);
      when(() => repo.records('v1')).thenAnswer((_) async => [record]);
      when(() => repo.reminders('v1')).thenAnswer((_) async => [reminder]);
      return build();
    },
    act: (c) => c.load(),
    expect: () => [
      const MaintenanceState(status: MaintenanceStatus.loading),
      const MaintenanceState(
        status: MaintenanceStatus.ready,
        vehicle: vehicle,
        records: [record],
        reminders: [reminder],
      ),
    ],
  );

  blocTest<MaintenanceCubit, MaintenanceState>(
    'load: falha → error',
    build: () {
      when(() => repo.myVehicle()).thenThrow(const NetworkFailure());
      return build();
    },
    act: (c) => c.load(),
    expect: () => [
      const MaintenanceState(status: MaintenanceStatus.loading),
      const MaintenanceState(status: MaintenanceStatus.error, error: NetworkFailure()),
    ],
  );

  blocTest<MaintenanceCubit, MaintenanceState>(
    'addRecord: envia e recarrega os derivados',
    build: () {
      when(() => repo.myVehicle()).thenAnswer((_) async => vehicle);
      when(() => repo.records('v1')).thenAnswer((_) async => [record]);
      when(() => repo.reminders('v1')).thenAnswer((_) async => [reminder]);
      when(() => repo.addRecord(any(), any())).thenAnswer((_) async {});
      return build();
    },
    act: (c) async {
      await c.load();
      await c.addRecord(const NewMaintenanceRecord(type: 'tires', performedAt: '2026-07-10'));
    },
    verify: (c) {
      verify(() => repo.addRecord('v1', any())).called(1);
      // recarrega registros/lembretes após a mutação (load + mutação = 2 chamadas)
      verify(() => repo.records('v1')).called(2);
    },
  );

  blocTest<MaintenanceCubit, MaintenanceState>(
    'updateOdometer: envia o novo valor',
    build: () {
      when(() => repo.myVehicle()).thenAnswer((_) async => vehicle);
      when(() => repo.records('v1')).thenAnswer((_) async => [record]);
      when(() => repo.reminders('v1')).thenAnswer((_) async => [reminder]);
      when(() => repo.updateOdometer(any(), any())).thenAnswer((_) async {});
      return build();
    },
    act: (c) async {
      await c.load();
      await c.updateOdometer(130000);
    },
    verify: (c) => verify(() => repo.updateOdometer('v1', 130000)).called(1),
  );
}
