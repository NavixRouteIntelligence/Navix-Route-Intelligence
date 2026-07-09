import 'package:equatable/equatable.dart';

/// Ambientes (flavors) do app.
enum Flavor { dev, prod }

/// Configuração imutável do ambiente atual. Injetada no bootstrap por flavor.
/// Valores sensíveis nunca ficam no código — use `--dart-define` no build.
class AppConfig extends Equatable {
  const AppConfig({
    required this.flavor,
    required this.appName,
    required this.apiBaseUrl,
    this.enableLogging = true,
  });

  final Flavor flavor;
  final String appName;

  /// Base da API, incluindo o prefixo de versão (ex.: http://10.0.2.2:3001/api/v1).
  final String apiBaseUrl;

  final bool enableLogging;

  bool get isProd => flavor == Flavor.prod;
  bool get isDev => flavor == Flavor.dev;

  /// Config de desenvolvimento. `API_BASE_URL` pode ser sobrescrito por dart-define.
  factory AppConfig.dev() => const AppConfig(
        flavor: Flavor.dev,
        appName: 'Navix (Dev)',
        apiBaseUrl: String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'http://10.0.2.2:3001/api/v1',
        ),
        enableLogging: true,
      );

  /// Config de produção. `API_BASE_URL` deve vir do pipeline via dart-define.
  factory AppConfig.prod() => const AppConfig(
        flavor: Flavor.prod,
        appName: 'Navix',
        apiBaseUrl: String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'https://api.navix.app/api/v1',
        ),
        enableLogging: false,
      );

  @override
  List<Object?> get props => [flavor, appName, apiBaseUrl, enableLogging];
}
