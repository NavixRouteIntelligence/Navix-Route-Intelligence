import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/route/domain/route_navigation.dart';

void main() {
  test('gera deep link universal de direção sem origem fixa', () {
    const target = RouteNavigationTarget(
      deliveryId: 'delivery-1',
      latitude: 38.7223,
      longitude: -9.1393,
    );

    expect(target.uri.scheme, 'https');
    expect(target.uri.host, 'www.google.com');
    expect(target.uri.path, '/maps/dir/');
    expect(target.uri.queryParameters, {
      'api': '1',
      'destination': '38.7223,-9.1393',
      'travelmode': 'driving',
      'dir_action': 'navigate',
    });
  });
}
