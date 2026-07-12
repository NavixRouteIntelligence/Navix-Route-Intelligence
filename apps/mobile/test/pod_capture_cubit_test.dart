import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/location/location_service.dart';
import 'package:navix_mobile/features/driver/data/tracking_repository.dart';
import 'package:navix_mobile/features/pod/data/pod_queue_store.dart';
import 'package:navix_mobile/features/pod/data/pod_repository.dart';
import 'package:navix_mobile/features/pod/presentation/pod_capture_cubit.dart';

class _MockPod extends Mock implements PodRepository {}

class _MockLocation extends Mock implements LocationService {}

class _MockTracking extends Mock implements TrackingRepository {}

class _MockQueue extends Mock implements PodQueueStore {}

void main() {
  late _MockPod pod;
  late _MockLocation location;
  late _MockTracking tracking;
  late _MockQueue queue;

  const sample = LocationSample(latitude: -23.55, longitude: -46.63);

  setUpAll(() {
    registerFallbackValue(const PodSubmission(deliveryId: 'x', status: 'delivered'));
    registerFallbackValue(sample);
  });

  setUp(() {
    pod = _MockPod();
    location = _MockLocation();
    tracking = _MockTracking();
    queue = _MockQueue();
  });

  PodCaptureCubit build() => PodCaptureCubit(pod, location, tracking, queue);

  test('captureLocation sucesso: gps done com coordenadas', () async {
    when(() => location.current()).thenAnswer((_) async => sample);
    final cubit = build();
    await cubit.captureLocation();
    expect(cubit.state.gps, GpsStatus.done);
    expect(cubit.state.latitude, -23.55);
  });

  test('captureLocation falha: gps error', () async {
    when(() => location.current()).thenThrow(const LocationException('negada'));
    final cubit = build();
    await cubit.captureLocation();
    expect(cubit.state.gps, GpsStatus.error);
  });

  test('submit sucesso: envia POD, registra posição finished e conclui', () async {
    when(() => location.current()).thenAnswer((_) async => sample);
    when(() => pod.submit(any())).thenAnswer((_) async {});
    when(() => tracking.sendPosition(any(), status: any(named: 'status'))).thenAnswer((_) async {});

    final cubit = build();
    await cubit.captureLocation();
    await cubit.submit(deliveryId: 'del-1', status: 'delivered', photoDataUrl: 'data:image/jpeg;base64,AAA');

    expect(cubit.state.done, isTrue);
    expect(cubit.state.error, isNull);
    verify(() => pod.submit(any())).called(1);
    verify(() => tracking.sendPosition(any(), status: 'finished')).called(1);
  });

  test('submit sem conexão: enfileira e conclui como pendente (queued)', () async {
    when(() => pod.submit(any())).thenThrow(const NetworkFailure());
    when(() => queue.enqueue(any())).thenAnswer((_) async {});
    final cubit = build();
    await cubit.submit(deliveryId: 'del-1', status: 'absent');
    expect(cubit.state.done, isTrue);
    expect(cubit.state.queued, isTrue);
    expect(cubit.state.error, isNull);
    verify(() => queue.enqueue(any())).called(1);
  });

  test('submit erro não-rede: mensagem de erro e não conclui', () async {
    when(() => pod.submit(any())).thenThrow(const ServerFailure('Erro no servidor.'));
    final cubit = build();
    await cubit.submit(deliveryId: 'del-1', status: 'absent');
    expect(cubit.state.done, isFalse);
    expect(cubit.state.queued, isFalse);
    expect(cubit.state.error, isNotNull);
    verifyNever(() => queue.enqueue(any()));
  });
}
