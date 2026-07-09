import 'bootstrap.dart';
import 'core/config/app_config.dart';

/// Entrypoint do flavor de desenvolvimento:
///   flutter run --flavor dev -t lib/main_dev.dart
Future<void> main() => bootstrap(AppConfig.dev());
