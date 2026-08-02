import 'package:url_launcher/url_launcher.dart';

import '../domain/route_navigation.dart';

class UrlRouteNavigationLauncher implements RouteNavigationLauncher {
  @override
  Future<bool> open(RouteNavigationTarget target) async {
    try {
      return await launchUrl(target.uri, mode: LaunchMode.externalApplication);
    } on Exception {
      return false;
    }
  }
}
