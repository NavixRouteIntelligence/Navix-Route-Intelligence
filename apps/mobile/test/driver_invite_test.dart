import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/network/dio_failure_mapper.dart';
import 'package:navix_mobile/core/storage/secure_session_store.dart';
import 'package:navix_mobile/features/auth/data/auth_api.dart';
import 'package:navix_mobile/features/auth/data/auth_repository_impl.dart';
import 'package:navix_mobile/features/auth/domain/auth_entities.dart';
import 'package:navix_mobile/features/auth/presentation/invite_page.dart';

class _MockApi extends Mock implements AuthApi {}

class _MockStore extends Mock implements SecureSessionStore {}

const _token = 'q7SbOn20FGrqxAdbw7iI2LuH1HHXvD24PvekrcPO6b4';

Map<String, dynamic> _sessionJson({required String email}) => {
      'user': {
        'id': 'u1',
        'tenantId': 'tenant-a',
        'email': email,
        'roles': ['driver'],
      },
      'tokens': {
        'accessToken': 'access',
        'refreshToken': 'refresh',
        'expiresIn': 900,
      },
    };

DioException _notFound() {
  final req = RequestOptions(path: '/public/driver-invites/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(requestOptions: req, statusCode: 404),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(
      const AcceptInviteParams(token: _token, password: 'password'),
    );
    registerFallbackValue(
      const LoginParams(email: 'e@x.com', password: 'password'),
    );
    registerFallbackValue(
      const StoredUser(id: 'u', tenantId: 't', email: 'e', roles: ['driver']),
    );
  });

  group('extractInviteToken', () {
    // O motorista recebe uma URL por WhatsApp; colar tudo é o gesto natural.
    test('extrai o token de um link inteiro', () {
      expect(
        extractInviteToken('https://app.navix.pt/convite/$_token'),
        _token,
      );
    });

    test('aceita o código solto, com espaços em volta', () {
      expect(extractInviteToken('  $_token  '), _token);
    });

    test('devolve null quando não há token de 43 caracteres', () {
      expect(extractInviteToken('https://app.navix.pt/convite/abc'), isNull);
      expect(extractInviteToken(''), isNull);
    });
  });

  group('AuthRepositoryImpl — convite (ADR-0085)', () {
    late _MockApi api;
    late _MockStore store;
    late AuthRepositoryImpl repo;

    setUp(() {
      api = _MockApi();
      store = _MockStore();
      when(() => store.saveSession(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
            user: any(named: 'user'),
          )).thenAnswer((_) async {});
      repo = AuthRepositoryImpl(api: api, store: store);
    });

    test('validateInvite mapeia a resposta pública', () async {
      when(() => api.validateInvite(_token)).thenAnswer((_) async => {
            'data': {
              'email': 'maria@exemplo.pt',
              'organizationName': 'Transportes Aurora',
              'requiresDriverDetails': true,
            },
          });

      final preview = await repo.validateInvite(_token);

      expect(preview.email, 'maria@exemplo.pt');
      expect(preview.organizationName, 'Transportes Aurora');
      expect(preview.requiresDriverDetails, isTrue);
    });

    test('404 vira convite inválido, e não erro de servidor', () async {
      when(() => api.validateInvite(_token)).thenThrow(_notFound());

      expect(
        () => repo.validateInvite(_token),
        throwsA(isA<InviteNotFoundFailure>()),
      );
    });

    // O aceite não emite sessão (o endpoint é público — ADR-0085): o app entra
    // com a senha que o motorista acabou de escolher.
    test('acceptInvite cria a conta e autentica na sequência', () async {
      when(() => api.acceptInvite(any())).thenAnswer((_) async => {
            'data': {
              'email': 'maria@exemplo.pt',
              'organizationName': 'Transportes Aurora',
            },
          });
      when(() => api.login(any()))
          .thenAnswer((_) async => _sessionJson(email: 'maria@exemplo.pt'));

      final session = await repo.acceptInvite(
        const AcceptInviteParams(token: _token, password: 'senha-forte-123'),
      );

      expect(session.user.email, 'maria@exemplo.pt');
      expect(session.user.roles, ['driver']);

      // O login usa o e-mail que veio do TOKEN, não algo escolhido no cliente.
      final usado = verify(() => api.login(captureAny())).captured.single
          as LoginParams;
      expect(usado.email, 'maria@exemplo.pt');
      expect(usado.password, 'senha-forte-123');
    });

    test('convite consumido entre abrir e enviar não autentica', () async {
      when(() => api.acceptInvite(any())).thenThrow(_notFound());

      expect(
        () => repo.acceptInvite(
          const AcceptInviteParams(token: _token, password: 'senha-forte-123'),
        ),
        throwsA(isA<InviteNotFoundFailure>()),
      );
      verifyNever(() => api.login(any()));
    });
  });

  group('mapDioException — seam do 404', () {
    test('sem override, 404 continua sendo falha de servidor', () {
      expect(mapDioException(_notFound()), isA<ServerFailure>());
    });

    test('com override, vira a falha do convite', () {
      expect(
        mapDioException(_notFound(), notFound: const InviteNotFoundFailure()),
        isA<InviteNotFoundFailure>(),
      );
    });
  });
}
