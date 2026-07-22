import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'navix_mark.dart';

/// Paleta do splash, derivada dos tokens oficiais da Navix. Não existe um
/// "gradiente da marca" documentado em `docs/design-tokens.md`, então ele é
/// composto aqui a partir de `primary`, `accent` e o fundo escuro — mantendo a
/// identidade sem inventar cores novas.
@immutable
class SplashPalette {
  const SplashPalette({
    required this.background,
    required this.primary,
    required this.accent,
  });

  final Color background;
  final Color primary;
  final Color accent;

  /// Fundo em profundidade: um radial quente no centro sobre a base escura.
  Gradient get backgroundGradient => RadialGradient(
        center: const Alignment(0, -0.18),
        radius: 1.1,
        colors: [
          Color.lerp(background, primary, 0.30)!,
          Color.lerp(background, primary, 0.10)!,
          background,
        ],
        stops: const [0.0, 0.45, 1.0],
      );
}

/// Desenha a história do splash num único passe: rota traçada → marca revelada
/// → partículas em órbita. Todos os estágios são fatias do mesmo progresso, o
/// que mantém uma só `Ticker` e nenhum widget por partícula.
class NavixSplashPainter extends CustomPainter {
  const NavixSplashPainter({
    required this.palette,
    required this.trace,
    required this.reveal,
    required this.orbit,
    required this.parallax,
    required this.particleCount,
  });

  /// 0→1: quanto da rota já foi percorrida pelo ponto de luz.
  final double trace;

  /// 0→1: revelação da marca completa (traço cheio + seta + brilho).
  final double reveal;

  /// Fase contínua das partículas em órbita (radianos).
  final double orbit;

  /// Deslocamento sutil de profundidade, em pixels lógicos.
  final Offset parallax;

  final SplashPalette palette;
  final int particleCount;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final side = math.min(size.width, size.height) * 0.42;

    final route = NavixMark.scaleTo(NavixMark.routePath(), center: center + parallax, side: side);
    final stroke = side * 0.085;

    _paintHalo(canvas, center + parallax * 0.4, side, reveal);
    _paintRouteGhost(canvas, route, stroke);
    _paintTrace(canvas, route, stroke);
    if (reveal > 0) _paintArrow(canvas, center + parallax, side);
    if (orbit != 0 && reveal > 0) _paintParticles(canvas, center + parallax * 1.6, side, reveal);
  }

  /// Brilho difuso atrás da marca — cresce conforme a revelação.
  void _paintHalo(Canvas canvas, Offset center, double side, double t) {
    if (t <= 0) return;
    final radius = side * (0.62 + 0.30 * t);
    final paint = Paint()
      ..shader = ui.Gradient.radial(center, radius, [
        palette.accent.withValues(alpha: 0.26 * t),
        palette.primary.withValues(alpha: 0.12 * t),
        palette.primary.withValues(alpha: 0),
      ], const [0.0, 0.55, 1.0]);
    canvas.drawCircle(center, radius, paint);
  }

  /// O caminho ainda não percorrido, quase imperceptível: dá a noção de "rota
  /// planejada" antes de ser executada.
  void _paintRouteGhost(Canvas canvas, Path route, double stroke) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke * 0.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = palette.primary.withValues(alpha: 0.16);
    canvas.drawPath(route, paint);
  }

  /// A rota efetivamente percorrida, com um ponto de luz na ponta.
  void _paintTrace(Canvas canvas, Path route, double stroke) {
    if (trace <= 0) return;
    final metrics = route.computeMetrics().toList();
    if (metrics.isEmpty) return;
    final total = metrics.fold<double>(0, (sum, m) => sum + m.length);
    final target = total * trace.clamp(0.0, 1.0);

    final drawn = Path();
    var consumed = 0.0;
    Offset? head;
    for (final metric in metrics) {
      if (consumed >= target) break;
      final take = math.min(metric.length, target - consumed);
      drawn.addPath(metric.extractPath(0, take), Offset.zero);
      final tangent = metric.getTangentForOffset(take);
      if (tangent != null) head = tangent.position;
      consumed += take;
    }

    // Traço principal em gradiente (primary → accent): a rota "ganhando vida".
    final bounds = route.getBounds();
    canvas.drawPath(
      drawn,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..shader = ui.Gradient.linear(
          bounds.bottomLeft,
          bounds.topRight,
          [palette.primary, palette.accent],
        ),
    );

    // Brilho ao longo do traço já percorrido.
    canvas.drawPath(
      drawn,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke * 1.9
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = palette.accent.withValues(alpha: 0.18)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, stroke * 0.9),
    );

    // Ponto de luz: só enquanto a rota está sendo calculada.
    if (head != null && trace < 1) {
      final r = stroke * 0.92;
      canvas.drawCircle(head, r * 2.4, Paint()..color = palette.accent.withValues(alpha: 0.22));
      canvas.drawCircle(head, r, Paint()..color = Colors.white);
    }
  }

  /// Seta de navegação no destino — a rota virando identidade.
  void _paintArrow(Canvas canvas, Offset center, double side) {
    final arrow = NavixMark.scaleTo(NavixMark.arrowPath(), center: center, side: side);
    final popped = NavixMark.scaleAroundCenter(arrow, 0.6 + 0.4 * reveal);
    canvas.drawPath(popped, Paint()..color = palette.accent.withValues(alpha: reveal.clamp(0.0, 1.0)));
  }

  /// Partículas em órbita: inteligência, movimento e conexão. Posições puramente
  /// trigonométricas — sem alocação por frame além do próprio Paint.
  void _paintParticles(Canvas canvas, Offset center, double side, double t) {
    final paint = Paint();
    for (var i = 0; i < particleCount; i++) {
      final phase = (i / particleCount) * math.pi * 2;
      final speed = 0.6 + (i % 3) * 0.22;
      final angle = orbit * speed + phase;
      final radius = side * (0.72 + 0.16 * math.sin(orbit * 0.8 + phase * 1.7));
      final position = Offset(
        center.dx + math.cos(angle) * radius,
        center.dy + math.sin(angle) * radius * 0.58,
      );
      // Partículas "atrás" da marca ficam mais discretas — dá profundidade.
      final depth = (math.sin(angle) + 1) / 2;
      final alpha = (0.16 + 0.44 * depth) * t;
      final r = side * (0.012 + 0.014 * depth);
      paint.color = (i.isEven ? palette.accent : Colors.white).withValues(alpha: alpha);
      canvas.drawCircle(position, r, paint);
    }
  }

  @override
  bool shouldRepaint(NavixSplashPainter old) =>
      old.trace != trace ||
      old.reveal != reveal ||
      old.orbit != orbit ||
      old.parallax != parallax ||
      old.palette != palette;
}
