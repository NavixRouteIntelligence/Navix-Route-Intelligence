import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

/// Geometria da marca Navix, desenhada como uma **rota**: uma polilinha que sobe,
/// desce na diagonal e sobe de novo — o "N" — terminando numa seta de navegação.
///
/// É uma função pura sobre uma caixa normalizada de 100×100, sem dependência de
/// widgets: dá para medir, testar e reusar (splash, marca d'água, ícone).
/// O traçado progressivo do splash usa [PathMetrics] sobre [routePath].
abstract final class NavixMark {
  /// Lado da caixa de design. Escale com [scaleTo] para o tamanho real.
  static const double designSize = 100;

  /// Vértices da rota que formam o "N" (na caixa de design).
  static const List<Offset> waypoints = [
    Offset(22, 78), // origem — canto inferior esquerdo
    Offset(22, 26), // sobe
    Offset(72, 78), // diagonal descendente
    Offset(72, 26), // sobe — chegada
  ];

  /// Ponto de partida da rota (onde nasce o ponto de luz).
  static Offset get origin => waypoints.first;

  /// Ponto de chegada (onde a seta de navegação é revelada).
  static Offset get destination => waypoints.last;

  /// A rota em si, com cantos suavizados — é este caminho que o ponto de luz
  /// percorre e que "desenha" a marca.
  static Path routePath({double cornerRadius = 7}) {
    final path = Path()..moveTo(waypoints.first.dx, waypoints.first.dy);
    for (var i = 1; i < waypoints.length - 1; i++) {
      final current = waypoints[i];
      final next = waypoints[i + 1];
      final incoming = _pointBefore(waypoints[i - 1], current, cornerRadius);
      final outgoing = _pointBefore(next, current, cornerRadius);
      path.lineTo(incoming.dx, incoming.dy);
      path.quadraticBezierTo(current.dx, current.dy, outgoing.dx, outgoing.dy);
    }
    path.lineTo(waypoints.last.dx, waypoints.last.dy);
    return path;
  }

  /// Seta de navegação que termina a rota — o "ponteiro" que ela vira ao chegar.
  /// A ponta fica ACIMA do destino para o traço não invadir a silhueta: a rota
  /// sobe e desemboca na seta, em vez de a seta se espetar sobre o traço.
  static Path arrowPath({double size = 24}) {
    final tip = Offset(destination.dx, destination.dy - size * 0.62);
    final half = size / 2;
    return Path()
      ..moveTo(tip.dx, tip.dy)
      ..lineTo(tip.dx + half, tip.dy + size * 0.88)
      ..lineTo(tip.dx, tip.dy + size * 0.60)
      ..lineTo(tip.dx - half, tip.dy + size * 0.88)
      ..close();
  }

  /// Converte um caminho da caixa de design para um quadrado de lado [side]
  /// centrado em [center].
  static Path scaleTo(Path path, {required Offset center, required double side}) {
    final factor = side / designSize;
    return path.transform(affine(
      scale: factor,
      tx: center.dx - side / 2,
      ty: center.dy - side / 2,
    ));
  }

  /// Matriz afim 4×4 (escala uniforme + translação) em ordem *column-major*,
  /// como `Path.transform` espera. Evita depender de `Matrix4` — que não existe
  /// em `dart:ui` — e da sua API de `translate`/`scale`, já depreciada.
  static Float64List affine({double scale = 1, double tx = 0, double ty = 0}) {
    final m = Float64List(16);
    m[0] = scale;
    m[5] = scale;
    m[10] = 1;
    m[12] = tx;
    m[13] = ty;
    m[15] = 1;
    return m;
  }

  /// Escala [path] em torno do seu próprio centro (para revelações "pop").
  static Path scaleAroundCenter(Path path, double factor) {
    final pivot = path.getBounds().center;
    return path.transform(affine(
      scale: factor,
      tx: pivot.dx * (1 - factor),
      ty: pivot.dy * (1 - factor),
    ));
  }

  /// Ponto a [distance] de [corner] na direção de [from], usado para arredondar
  /// o vértice sem deformar a rota.
  static Offset _pointBefore(Offset from, Offset corner, double distance) {
    final dx = from.dx - corner.dx;
    final dy = from.dy - corner.dy;
    final length = math.sqrt(dx * dx + dy * dy);
    if (length == 0) return corner;
    final clamped = math.min(distance, length / 2);
    return Offset(corner.dx + dx / length * clamped, corner.dy + dy / length * clamped);
  }
}
