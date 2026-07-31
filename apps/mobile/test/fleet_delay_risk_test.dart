import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/tracking/domain/fleet_tracking.dart';
import 'package:navix_mobile/features/tracking/presentation/fleet_tracking_cubit.dart';

TrackedDriver motorista(String id, String nome) => TrackedDriver(
      id: id,
      name: nome,
      status: TrackStatus.enRoute,
      latitude: 38.72,
      longitude: -9.14,
      speedKmh: 30,
      recordedAt: DateTime.now(),
    );

DelayRisk risco({
  String severity = 'medium',
  double probability = 0.45,
  double slackMinutes = 12,
  String? driverId = 'ficha-1',
}) =>
    DelayRisk(
      deliveryId: 'entrega-1',
      driverId: driverId,
      severity: severity,
      probability: probability,
      slackMinutes: slackMinutes,
    );

FleetTrackingState comRiscos(List<DelayRisk> risks) => FleetTrackingState(
      status: FleetStatus.success,
      snapshot: FleetSnapshot(
        drivers: [motorista('ficha-1', 'Maria Souza')],
        risks: risks,
      ),
    );

void main() {
  group('alertas preditivos na frota (ADR-0091)', () {
    test('mostra a chance e a folga, que é o que decide reordenar', () {
      final alertas = comRiscos([risco()]).alerts;

      expect(
        alertas.first.message,
        'Maria Souza: 45% de risco de estourar a janela — restam 12 min de folga.',
      );
      expect(alertas.first.severity, 'warning');
    });

    test('risco alto vira severidade de perigo', () {
      final alertas =
          comRiscos([risco(severity: 'high', probability: 0.85)]).alerts;

      expect(alertas.first.severity, 'danger');
      expect(alertas.first.message, contains('85%'));
    });

    test('folga negativa é dita como já estourada', () {
      final alertas =
          comRiscos([risco(slackMinutes: -8, severity: 'high')]).alerts;

      expect(alertas.first.message, contains('já 8 min além da janela'));
    });

    test('entrega sem motorista não vira "null"', () {
      final alertas = comRiscos([risco(driverId: null)]).alerts;

      expect(alertas.first.message, contains('Entrega sem motorista'));
    });

    // Um estouro de janela pesa mais que um GPS instável.
    test('preditivos vêm antes dos operacionais', () {
      final state = FleetTrackingState(
        status: FleetStatus.success,
        snapshot: FleetSnapshot(
          drivers: [
            TrackedDriver(
              id: 'ficha-1',
              name: 'Maria Souza',
              status: TrackStatus.stopped,
              latitude: 38.72,
              longitude: -9.14,
              recordedAt: DateTime.now(),
            ),
          ],
          risks: [risco()],
        ),
      );

      final alertas = state.alerts;

      expect(alertas.first.id, startsWith('risk-'));
      expect(alertas.last.id, startsWith('stop-'));
    });

    test('sem risco, só os alertas operacionais', () {
      final alertas = comRiscos(const []).alerts;

      expect(alertas.where((a) => a.id.startsWith('risk-')), isEmpty);
    });
  });
}
