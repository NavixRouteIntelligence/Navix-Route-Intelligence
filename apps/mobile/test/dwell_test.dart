import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/intelligence/domain/dwell.dart';

void main() {
  final start = DateTime(2026, 7, 16, 10);

  test('converte o intervalo em minutos (1 casa)', () {
    expect(dwellMinutes(start, start.add(const Duration(minutes: 6))), 6);
    expect(dwellMinutes(start, start.add(const Duration(seconds: 90))), 1.5);
  });

  test('nunca é negativo', () {
    expect(dwellMinutes(start, start.subtract(const Duration(minutes: 5))), 0);
  });

  test('satura no teto aceito pela API', () {
    expect(dwellMinutes(start, start.add(const Duration(hours: 20))), maxDwellMinutes);
  });
}
