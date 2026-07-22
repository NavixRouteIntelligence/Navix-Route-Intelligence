import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/location/location_service.dart';
import 'package:navix_mobile/features/driver/data/tracking_repository.dart';
import 'package:navix_mobile/features/driver/presentation/location_sharing_cubit.dart';

class _MockLocation extends Mock implements LocationService {}

class _MockTracking extends Mock implements TrackingRepository {}

void main() {
  late _MockLocation location;
  late _MockTracking tracking;

  const sample = LocationSample(latitude: -23.55, longitude: -46.63, speedKmh: 42);

  setUpAll(() => registerFallbackValue(sample));

  setUp(() {
    location = _MockLocation();
    tracking = _MockTracking();
  });

  LocationSharingCubit build() =>
      LocationSharingCubit(location, tracking, interval: const Duration(hours: 1));

  test('start: obtém posição, envia e passa a compartilhar', () async {
    when(() => location.current()).thenAnswer((_) async => sample);
    when(() => tracking.sendPosition(any(), status: any(named: 'status'))).thenAnswer((_) async {});

    final cubit = build();
    await cubit.start();

    expect(cubit.state.sharing, isTrue);
    expect(cubit.state.busy, isFalse);
    expect(cubit.state.error, isNull);
    verify(() => tracking.sendPosition(any(), status: any(named: 'status'))).called(1);

    await cubit.close();
  });

  test('start com permissão negada: não compartilha e emite erro', () async {
    when(() => location.current()).thenThrow(const LocationException(LocationErrorReason.permissionDenied));

    final cubit = build();
    await cubit.start();

    expect(cubit.state.sharing, isFalse);
    expect(cubit.state.error, const LocationFailure(LocationErrorReason.permissionDenied));
    verifyNever(() => tracking.sendPosition(any(), status: any(named: 'status')));

    await cubit.close();
  });

  test('stop: encerra o compartilhamento', () async {
    when(() => location.current()).thenAnswer((_) async => sample);
    when(() => tracking.sendPosition(any(), status: any(named: 'status'))).thenAnswer((_) async {});

    final cubit = build();
    await cubit.start();
    await cubit.stop();

    expect(cubit.state.sharing, isFalse);
    await cubit.close();
  });
}
