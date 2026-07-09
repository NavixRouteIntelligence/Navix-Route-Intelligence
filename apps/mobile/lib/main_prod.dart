import 'bootstrap.dart';
import 'core/config/app_config.dart';

/// Entrypoint do flavor de produção:
///   flutter run --flavor prod -t lib/main_prod.dart
Future<void> main() => bootstrap(AppConfig.prod());
