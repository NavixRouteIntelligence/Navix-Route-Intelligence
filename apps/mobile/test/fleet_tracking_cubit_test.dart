import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/tracking/data/fleet_tracking_repository.dart';
import 'package:navix_mobile/features/tracking/domain/fleet_tracking.dart';
import 'package:navix_mobile/features/tracking/presentation/fleet_tracking_cubit.dart';

class _MockRepo extends Mock implements FleetTrackingRepository {}

void main() {
  late _MockRepo repo;

  final now = DateTime.now();
  final snapshot = FleetSnapshot(
    updatedAt: now,
    drivers: [
      TrackedDriver(id: 'd1', name: 'Carlos Melo', status: TrackStatus.enRoute, latitude: -23.55, longitude: -46.63, speedKmh: 42, recordedAt: now),
      const TrackedDriver(id: 'd2', name: 'Ana Souza', status: TrackStatus.stopped, latitude: -23.56, longitude: -46.64, speedKmh: 0),
      const TrackedDriver(id: 'd3', name: 'João Lima', status: TrackStatus.offline),
    ],
  );

  setUp(() => repo = _MockRepo());

  test('snapshot: contadores e alertas derivados', () {
    expect(snapshot.onlineCount, 2); // enRoute + stopped
    expect(snapshot.offlineCount, 1);
    expect(snapshot.onMap.length, 2); // d1 e d2 têm posição
  });

  test('load sucesso: emite success com snapshot', () async {
    when(() => repo.loadFleet()).thenAnswer((_) async => snapshot);
    final cubit = FleetTrackingCubit(repo, interval: const Duration(hours: 1));
    await cubit.load();
    expect(cubit.state.status, FleetStatus.success);
    expect(cubit.state.snapshot?.drivers.length, 3);
    // Alertas: d2 parado (warning) → pelo menos 1 alerta.
    expect(cubit.state.alerts.any((a) => a.severity == 'warning'), isTrue);
    await cubit.close();
  });

  test('load falha: emite error', () async {
    when(() => repo.loadFleet()).thenThrow(const NetworkFailure());
    final cubit = FleetTrackingCubit(repo, interval: const Duration(hours: 1));
    await cubit.load();
    expect(cubit.state.status, FleetStatus.error);
    expect(cubit.state.error, const NetworkFailure());
    await cubit.close();
  });

  test('select: carrega histórico do motorista', () async {
    when(() => repo.loadFleet()).thenAnswer((_) async => snapshot);
    when(() => repo.loadHistory('d1')).thenAnswer((_) async => const []);
    final cubit = FleetTrackingCubit(repo, interval: const Duration(hours: 1));
    await cubit.load();
    await cubit.select('d1');
    expect(cubit.state.selectedId, 'd1');
    expect(cubit.state.selected?.name, 'Carlos Melo');
    verify(() => repo.loadHistory('d1')).called(1);
    await cubit.close();
  });
}
