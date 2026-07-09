import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/logging/app_logger.dart';
import 'package:navix_mobile/core/session/session_cubit.dart';
import 'package:navix_mobile/core/session/session_state.dart';

void main() {
  final logger = AppLogger(enabled: false);

  group('SessionCubit', () {
    blocTest<SessionCubit, SessionState>(
      'bootstrap sem token → não autenticado',
      build: () => SessionCubit(logger),
      act: (cubit) => cubit.bootstrap(),
      expect: () => [
        const SessionState.unauthenticated(),
      ],
    );

    blocTest<SessionCubit, SessionState>(
      'signInAs(driver) autentica como motorista',
      build: () => SessionCubit(logger),
      act: (cubit) => cubit.signInAs(UserRole.driver),
      verify: (cubit) {
        expect(cubit.state.isAuthenticated, isTrue);
        expect(cubit.state.isDriver, isTrue);
      },
    );

    blocTest<SessionCubit, SessionState>(
      'signOut volta para não autenticado',
      build: () => SessionCubit(logger),
      seed: () => const SessionState(status: SessionStatus.authenticated, role: UserRole.company),
      act: (cubit) => cubit.signOut(),
      expect: () => [const SessionState.unauthenticated()],
    );
  });
}
