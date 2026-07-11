import 'package:get_it/get_it.dart';

import '../../features/auth/data/auth_api.dart';
import '../../features/auth/data/auth_repository_impl.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/dashboard/data/dashboard_repository.dart';
import '../../features/dashboard/presentation/dashboard_cubit.dart';
import '../../features/driver/data/driver_dashboard_repository.dart';
import '../../features/driver/data/tracking_repository.dart';
import '../../features/driver/presentation/driver_dashboard_cubit.dart';
import '../../features/driver/presentation/location_sharing_cubit.dart';
import '../location/location_service.dart';
import '../../features/imports/data/import_repository.dart';
import '../../features/imports/presentation/import_cubit.dart';
import '../../features/pod/data/pod_repository.dart';
import '../../features/pod/presentation/pod_capture_cubit.dart';
import '../../features/tracking/data/fleet_tracking_repository.dart';
import '../../features/tracking/presentation/fleet_tracking_cubit.dart';
import '../config/app_config.dart';
import '../error/error_handler.dart';
import '../logging/app_logger.dart';
import '../network/dio_client.dart';
import '../security/biometric_service.dart';
import '../session/session_cubit.dart';
import '../storage/secure_session_store.dart';
import '../theme/theme_cubit.dart';

/// Container global de injeção de dependências.
final GetIt getIt = GetIt.instance;

/// Registra as dependências transversais e da feature de Auth. Cada nova feature
/// adiciona as suas ao evoluir — este é o ponto único de wiring.
Future<void> configureDependencies(AppConfig config) async {
  getIt
    ..registerSingleton<AppConfig>(config)
    ..registerSingleton<AppLogger>(
      AppLogger(
        enabled: config.enableLogging,
        minLevel: config.isProd ? LogLevel.warning : LogLevel.debug,
      ),
    )
    ..registerSingleton<AppErrorHandler>(AppErrorHandler(getIt<AppLogger>()))
    ..registerSingleton<SecureSessionStore>(SecureSessionStore())
    ..registerSingleton<BiometricService>(BiometricService())
    ..registerSingleton<DioClient>(
      DioClient(config: config, store: getIt<SecureSessionStore>()),
    )
    ..registerSingleton<AuthApi>(
      AuthApi(authDio: getIt<DioClient>().authDio, apiDio: getIt<DioClient>().apiDio),
    )
    ..registerSingleton<AuthRepository>(
      AuthRepositoryImpl(api: getIt<AuthApi>(), store: getIt<SecureSessionStore>()),
    )
    ..registerLazySingleton<SessionCubit>(
      () => SessionCubit(
        repository: getIt<AuthRepository>(),
        store: getIt<SecureSessionStore>(),
        biometric: getIt<BiometricService>(),
        logger: getIt<AppLogger>(),
      ),
    )
    ..registerLazySingleton<ThemeCubit>(() => ThemeCubit(getIt<SecureSessionStore>()))
    ..registerLazySingleton<DashboardRepository>(
      () => DashboardRepository(getIt<DioClient>().apiDio),
    )
    ..registerFactory<DashboardCubit>(() => DashboardCubit(getIt<DashboardRepository>()))
    ..registerLazySingleton<DriverDashboardRepository>(
      () => DriverDashboardRepository(getIt<DioClient>().apiDio),
    )
    ..registerFactory<DriverDashboardCubit>(() => DriverDashboardCubit(getIt<DriverDashboardRepository>()))
    ..registerSingleton<LocationService>(const LocationService())
    ..registerLazySingleton<TrackingRepository>(
      () => TrackingRepository(getIt<DioClient>().apiDio),
    )
    ..registerLazySingleton<LocationSharingCubit>(
      () => LocationSharingCubit(getIt<LocationService>(), getIt<TrackingRepository>()),
    )
    ..registerLazySingleton<ImportRepository>(
      () => ImportRepository(getIt<DioClient>().apiDio),
    )
    ..registerFactory<ImportCubit>(() => ImportCubit(getIt<ImportRepository>()))
    ..registerLazySingleton<PodRepository>(
      () => PodRepository(getIt<DioClient>().apiDio),
    )
    ..registerFactory<PodCaptureCubit>(
      () => PodCaptureCubit(getIt<PodRepository>(), getIt<LocationService>(), getIt<TrackingRepository>()),
    )
    ..registerLazySingleton<FleetTrackingRepository>(
      () => FleetTrackingRepository(getIt<DioClient>().apiDio),
    )
    ..registerFactory<FleetTrackingCubit>(() => FleetTrackingCubit(getIt<FleetTrackingRepository>()));
}
