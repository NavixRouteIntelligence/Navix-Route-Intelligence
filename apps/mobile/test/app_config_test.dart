import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/config/app_config.dart';

void main() {
  group('AppConfig', () {
    test('dev tem logging ligado e não é produção', () {
      final config = AppConfig.dev();
      expect(config.flavor, Flavor.dev);
      expect(config.isDev, isTrue);
      expect(config.isProd, isFalse);
      expect(config.enableLogging, isTrue);
      expect(config.apiBaseUrl, contains('/api/v1'));
    });

    test('prod é produção e sem logging', () {
      final config = AppConfig.prod();
      expect(config.flavor, Flavor.prod);
      expect(config.isProd, isTrue);
      expect(config.enableLogging, isFalse);
    });
  });
}
