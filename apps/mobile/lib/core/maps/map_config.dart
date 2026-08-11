/// Configuração do mapa (ADR-0128).
///
/// ## Por que um token só do telemóvel
///
/// O token do Mapbox é **público** — vai dentro do binário e qualquer pessoa
/// com o `.ipa` o extrai em minutos. Isso não é uma falha se ele for o token
/// certo: um token `pk.` com escopos de leitura de estilos e mapas, e nada
/// mais. O que não pode acontecer é reutilizar aqui o token do web ou o do
/// backend — o do backend chama Directions e Matrix, que **custam por pedido**,
/// e um token com esse escopo dentro de uma app é uma fatura aberta.
///
/// Por isso são três tokens distintos, um por superfície, e o rollover de um
/// não obriga a mexer nos outros. Ver `docs/runbook.md` para a rotação.
///
/// ## Por que não há valor por omissão
///
/// Sem `defaultValue`, um build sem `--dart-define` fica com token vazio e o
/// mapa não aparece — em vez de aparecer com o token de outro ambiente. Um
/// default silencioso faria a app de produção desenhar mapas na conta de
/// desenvolvimento, e a conta erra em silêncio até à fatura.
class MapConfig {
  const MapConfig({required this.accessToken, required this.environment});

  /// Lê a configuração dos `--dart-define` do build.
  ///
  /// `MAPBOX_PUBLIC_TOKEN` é o token do **telemóvel**, distinto por ambiente:
  /// o pipeline passa o de dev, de staging ou de produção conforme o alvo.
  factory MapConfig.fromEnvironment() => const MapConfig(
        accessToken: String.fromEnvironment('MAPBOX_PUBLIC_TOKEN'),
        environment: String.fromEnvironment('MAPBOX_ENV', defaultValue: 'dev'),
      );

  final String accessToken;

  /// Qual conjunto de credenciais este build está a usar. Aparece no ecrã de
  /// diagnóstico: descobrir que um build de staging usa o token de produção
  /// depois de ele estar na loja é caro.
  final String environment;

  /// `true` quando há token utilizável. Um token que não começa por `pk.` não
  /// é público — provavelmente é um `sk.` colado por engano, e esse **nunca**
  /// pode entrar num binário.
  bool get isEnabled =>
      accessToken.startsWith('pk.') && accessToken.length > 20;

  /// Por que o mapa não está disponível, para a tela poder explicar-se.
  MapUnavailableReason? get unavailableReason {
    if (accessToken.isEmpty) return MapUnavailableReason.missingToken;
    if (!accessToken.startsWith('pk.')) {
      return MapUnavailableReason.invalidToken;
    }
    return null;
  }
}

enum MapUnavailableReason {
  /// Build sem `--dart-define=MAPBOX_PUBLIC_TOKEN`.
  missingToken,

  /// Token presente mas não é um token público. Ver [MapConfig.isEnabled].
  invalidToken,
}
