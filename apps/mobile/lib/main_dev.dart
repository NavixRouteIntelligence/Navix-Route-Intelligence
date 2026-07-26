import 'bootstrap.dart';
import 'core/config/app_config.dart';

/// Entrypoint de desenvolvimento. O "flavor" aqui é só o entrypoint — o projeto
/// NÃO define flavors de Xcode/Gradle, então **não** use `--flavor` (falha com
/// "must specify a --flavor option"). A API vem por `--dart-define=API_BASE_URL`.
///
///   flutter run -t lib/main_dev.dart \
///     --dart-define=API_BASE_URL=https://navix-api.onrender.com/api/v1
///
/// Sem o dart-define, o default é http://10.0.2.2:3001/api/v1 (alias do
/// emulador Android para o host; no simulador iOS use localhost ou a URL acima).
Future<void> main() => bootstrap(AppConfig.dev());
