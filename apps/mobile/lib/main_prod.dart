import 'bootstrap.dart';
import 'core/config/app_config.dart';

/// Entrypoint de produção. Não há flavors de Xcode/Gradle — **não** use
/// `--flavor`. A URL da API vem do pipeline via `--dart-define=API_BASE_URL`.
///
///   flutter run -t lib/main_prod.dart --dart-define=API_BASE_URL=<url>
Future<void> main() => bootstrap(AppConfig.prod());
