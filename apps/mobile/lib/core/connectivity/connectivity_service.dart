import 'package:connectivity_plus/connectivity_plus.dart';

/// Abstração fina sobre o connectivity_plus — expõe apenas "online/offline".
class ConnectivityService {
  ConnectivityService([Connectivity? connectivity]) : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  Future<bool> isOnline() async => _online(await _connectivity.checkConnectivity());

  /// Emite `true` quando há alguma conexão, `false` quando fica offline.
  Stream<bool> get onlineChanges => _connectivity.onConnectivityChanged.map(_online);

  bool _online(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);
}
