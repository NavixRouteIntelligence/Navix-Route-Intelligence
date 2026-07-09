import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/session/session_state.dart';
import 'package:navix_mobile/features/auth/domain/auth_entities.dart';

AuthUser userWith(List<String> roles) =>
    AuthUser(id: '1', tenantId: 't', email: 'x@x.com', roles: roles);

void main() {
  group('AuthUser.role (RBAC)', () {
    test('driver → perfil motorista', () {
      expect(userWith(['driver']).role, UserRole.driver);
    });

    test('admin → perfil empresa', () {
      expect(userWith(['admin']).role, UserRole.company);
    });

    test('dispatcher/fleet_manager → perfil empresa', () {
      expect(userWith(['dispatcher']).role, UserRole.company);
      expect(userWith(['fleet_manager']).role, UserRole.company);
    });

    test('driver + admin → empresa (admin prevalece)', () {
      expect(userWith(['driver', 'admin']).role, UserRole.company);
    });
  });
}
