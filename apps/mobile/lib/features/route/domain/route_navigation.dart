import 'package:equatable/equatable.dart';

/// Destino externo de navegação. O [deliveryId] preserva o contexto operacional
/// quando o motorista volta ao Navix.
class RouteNavigationTarget extends Equatable {
  const RouteNavigationTarget({
    required this.deliveryId,
    required this.latitude,
    required this.longitude,
  });

  final String deliveryId;
  final double latitude;
  final double longitude;

  /// URL universal: abre o Google Maps instalado ou a experiência web, sempre
  /// em modo de direção e já solicitando o início da navegação.
  Uri get uri => Uri.https('www.google.com', '/maps/dir/', {
        'api': '1',
        'destination': '$latitude,$longitude',
        'travelmode': 'driving',
        'dir_action': 'navigate',
      });

  @override
  List<Object?> get props => [deliveryId, latitude, longitude];
}

/// Porta da aplicação para não acoplar o Cubit ao plugin nativo.
abstract interface class RouteNavigationLauncher {
  Future<bool> open(RouteNavigationTarget target);
}
