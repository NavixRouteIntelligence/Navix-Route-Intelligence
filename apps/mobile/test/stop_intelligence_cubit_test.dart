import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/intelligence/data/intelligence_repository.dart';
import 'package:navix_mobile/features/intelligence/domain/stop_intelligence.dart';
import 'package:navix_mobile/features/intelligence/presentation/stop_intelligence_cubit.dart';

class _MockRepo extends Mock implements IntelligenceRepository {}

void main() {
  late _MockRepo repo;

  const data = StopIntelligence(
    parking: ParkingPrediction(difficulty: 'hard', confidence: 0.8, walkMinutes: 5),
    access: ['Entrar pela doca'],
    insight: CollectiveInsight(
      sampleSize: 6,
      parkingDifficulty: 'hard',
      typicalServiceMinutes: 7,
      accessTips: ['Interfone 12'],
    ),
  );

  setUp(() => repo = _MockRepo());

  test('CollectiveInsight.hasSignal reflete presença de sinais', () {
    expect(data.insight!.hasSignal, isTrue);
    expect(const CollectiveInsight(sampleSize: 1).hasSignal, isFalse);
  });

  blocTest<StopIntelligenceCubit, StopIntelligenceState>(
    'load com sucesso: loading → success com dados',
    build: () {
      when(() => repo.loadForStop(
            id: any(named: 'id'),
            latitude: any(named: 'latitude'),
            longitude: any(named: 'longitude'),
            vehicleType: any(named: 'vehicleType'),
          )).thenAnswer((_) async => data);
      return StopIntelligenceCubit(repo);
    },
    act: (c) => c.load(latitude: -23.55, longitude: -46.63),
    expect: () => [
      const StopIntelligenceState(status: StopIntelligenceStatus.loading),
      const StopIntelligenceState(status: StopIntelligenceStatus.success, data: data),
    ],
  );

  blocTest<StopIntelligenceCubit, StopIntelligenceState>(
    'load com falha: loading → error com mensagem',
    build: () {
      when(() => repo.loadForStop(
            id: any(named: 'id'),
            latitude: any(named: 'latitude'),
            longitude: any(named: 'longitude'),
            vehicleType: any(named: 'vehicleType'),
          )).thenThrow(const NetworkFailure());
      return StopIntelligenceCubit(repo);
    },
    act: (c) => c.load(latitude: 0, longitude: 0),
    expect: () => const [
      StopIntelligenceState(status: StopIntelligenceStatus.loading),
      StopIntelligenceState(status: StopIntelligenceStatus.error, error: 'Sem conexão com o servidor.'),
    ],
  );
}
