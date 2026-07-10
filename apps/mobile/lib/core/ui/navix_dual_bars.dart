import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

/// Barras agrupadas (duas séries por rótulo), com animação de entrada.
/// Usado no Analytics (planejado × otimizado).
class NavixDualBars extends StatelessWidget {
  const NavixDualBars({
    super.key,
    required this.seriesA,
    required this.seriesB,
    required this.labels,
    required this.colorA,
    required this.colorB,
    this.height = 150,
  });

  final List<double> seriesA;
  final List<double> seriesB;
  final List<String> labels;
  final Color colorA;
  final Color colorB;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final n = seriesA.length;
    var max = 1.0;
    for (var i = 0; i < n; i++) {
      if (seriesA[i] > max) max = seriesA[i];
      if (i < seriesB.length && seriesB[i] > max) max = seriesB[i];
    }

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(n, (i) {
          final a = seriesA[i] / max;
          final b = (i < seriesB.length ? seriesB[i] : 0) / max;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _Bar(ratio: a, color: colorA, height: height, duration: t.motionSlow),
                      const SizedBox(width: 3),
                      _Bar(ratio: b, color: colorB, height: height, duration: t.motionSlow),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    i < labels.length ? labels[i] : '',
                    style: TextStyle(fontSize: 10.5, color: t.muted),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.ratio, required this.color, required this.height, required this.duration});
  final double ratio;
  final Color color;
  final double height;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: ratio.clamp(0, 1)),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, v, child) => Container(
        width: 10,
        height: 6 + v * (height - 30),
        decoration: BoxDecoration(
          color: color,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4), bottom: Radius.circular(2)),
        ),
      ),
    );
  }
}
