import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/logging/app_logger.dart';
import 'package:navix_mobile/core/security/biometric_service.dart';
import 'package:navix_mobile/core/session/session_cubit.dart';
import 'package:navix_mobile/core/session/session_state.dart';
import 'package:navix_mobile/core/storage/secure_session_store.dart';
import 'package:navix_mobile/features/auth/domain/auth_entities.dart';
import 'package:navix_mobile/features/auth/domain/auth_repository.dart';

class _MockRepo extends Mock implements AuthRepository {}

class _MockStore extends Mock implements SecureSessionStore {}

class _MockBiometric extends Mock implements BiometricService {}

void main() {
  late _MockRepo repo;
  late _MockStore store;
  late _MockBiometric bio;
  final logger = AppLogger(enabled: false);

  setUpAll(() {
    registerFallbackValue(const LoginParams(email: 'e@x.com', password: 'password'));
  });

  setUp(() {
    repo = _MockRepo();
    store = _MockStore();
    bio = _MockBiometric();
  });

  SessionCubit build() =>
      SessionCubit(repository: repo, store: store, biometric: bio, logger: logger);

  const driver = AuthSession(
    user: AuthUser(id: '1', tenantId: 't', email: 'd@x.com', roles: ['driver']),
    accessToken: 'a',
    refreshToken: 'r',
  );

  group('SessionCubit', () {
    blocTest<SessionCubit, SessionState>(
      'bootstrap sem sessão → não autenticado',
      build: build,
      setUp: () => when(() => store.hasSession()).thenAnswer((_) async => false),
      act: (c) => c.bootstrap(),
      expect: () => [const SessionState.unauthenticated()],
    );

    blocTest<SessionCubit, SessionState>(
      'login autentica e define o perfil (motorista)',
      build: build,
      setUp: () {
        when(() => repo.login(any())).thenAnswer((_) async => driver);
        when(() => store.setKeepConnected(any())).thenAnswer((_) async {});
        when(() => store.setBiometricEnabled(any())).thenAnswer((_) async {});
      },
      act: (c) => c.login(const LoginParams(email: 'd@x.com', password: 'password')),
      verify: (c) {
        expect(c.state.isAuthenticated, isTrue);
        expect(c.state.isDriver, isTrue);
      },
    );

    blocTest<SessionCubit, SessionState>(
      'logout volta para não autenticado',
      build: build,
      setUp: () => when(() => repo.logout()).thenAnswer((_) async {}),
      seed: () => const SessionState(status: SessionStatus.authenticated, role: UserRole.company),
      act: (c) => c.logout(),
      expect: () => [const SessionState.unauthenticated()],
    );
  });
}
