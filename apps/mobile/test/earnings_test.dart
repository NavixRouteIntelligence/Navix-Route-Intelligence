import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/features/earnings/data/tariff_store.dart';
import 'package:navix_mobile/features/earnings/domain/driver_tariff.dart';
import 'package:navix_mobile/features/earnings/presentation/earnings_cubit.dart';

class _MockStore extends Mock implements TariffStore {}

void main() {
  group('estimateEarnings', () {
    it_('tarifa por entrega + por km', () {
      const tariff = DriverTariff(perDelivery: 2.5, perKm: 0.4);
      expect(estimateEarnings(tariff, deliveries: 10, km: 20), 25 + 8); // 33.0
    });

    it_('só por entrega', () {
      const tariff = DriverTariff(perDelivery: 3, perKm: 0);
      expect(estimateEarnings(tariff, deliveries: 4, km: 50), 12);
    });

    it_('km negativo/zero não subtrai', () {
      const tariff = DriverTariff(perDelivery: 0, perKm: 1);
      expect(estimateEarnings(tariff, deliveries: 5, km: -3), 0);
    });

    it_('arredonda a 2 casas', () {
      const tariff = DriverTariff(perDelivery: 0, perKm: 0.333);
      expect(estimateEarnings(tariff, deliveries: 0, km: 10), 3.33);
    });
  });

  group('DriverTariff', () {
    it_('isConfigured quando qualquer valor > 0', () {
      expect(const DriverTariff().isConfigured, isFalse);
      expect(const DriverTariff(perDelivery: 1).isConfigured, isTrue);
      expect(const DriverTariff(perKm: 0.5).isConfigured, isTrue);
    });
  });

  group('EarningsCubit', () {
    late _MockStore store;
    setUpAll(() => registerFallbackValue(const DriverTariff()));
    setUp(() => store = _MockStore());

    test('load: lê a tarifa do armazém e marca loaded', () async {
      when(() => store.read()).thenAnswer((_) async => const DriverTariff(perDelivery: 2, perKm: 0.5));
      final cubit = EarningsCubit(store);
      await cubit.load();
      expect(cubit.state.loaded, isTrue);
      expect(cubit.state.tariff, const DriverTariff(perDelivery: 2, perKm: 0.5));
    });

    test('save: persiste e atualiza o estado, saneando negativos', () async {
      when(() => store.save(any())).thenAnswer((_) async {});
      final cubit = EarningsCubit(store);
      await cubit.save(perDelivery: -1, perKm: 0.7);
      expect(cubit.state.tariff, const DriverTariff(perDelivery: 0, perKm: 0.7));
      verify(() => store.save(const DriverTariff(perDelivery: 0, perKm: 0.7))).called(1);
    });
  });
}

/// Alias local para manter o padrão `test(...)` legível nos grupos acima.
void it_(String description, dynamic Function() body) => test(description, body);
