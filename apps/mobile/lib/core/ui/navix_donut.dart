import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

class DonutSegment {
  const DonutSegment(this.value, this.color);
  final double value;
  final Color color;
}

/// Gráfico donut com animação de entrada (micro-animação do DS).
class NavixDonut extends StatelessWidget {
  const NavixDonut({
    super.key,
    required this.segments,
    required this.centerValue,
    this.centerLabel,
    this.size = 96,
  });

  final List<DonutSegment> segments;
  final String centerValue;
  final String? centerLabel;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final total = segments.fold<double>(0, (a, s) => a + s.value);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: t.motionSlow,
      curve: Curves.easeOutCubic,
      builder: (context, progress, child) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _DonutPainter(segments: segments, total: total, track: t.line, progress: progress),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(centerValue, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                if (centerLabel != null)
                  Text(centerLabel!, style: TextStyle(color: t.muted, fontSize: 10)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.segments,
    required this.total,
    required this.track,
    required this.progress,
  });

  final List<DonutSegment> segments;
  final double total;
  final Color track;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.13;
    final rect = Rect.fromCircle(
      center: size.center(Offset.zero),
      radius: (size.width - stroke) / 2,
    );
    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawArc(rect, 0, 2 * math.pi, false, trackPaint);

    if (total <= 0) return;
    var start = -math.pi / 2;
    for (final seg in segments) {
      final sweep = (seg.value / total) * 2 * math.pi * progress;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt
        ..color = seg.color;
      canvas.drawArc(rect, start, sweep, false, paint);
      start += (seg.value / total) * 2 * math.pi;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.progress != progress || old.segments != segments;
}
