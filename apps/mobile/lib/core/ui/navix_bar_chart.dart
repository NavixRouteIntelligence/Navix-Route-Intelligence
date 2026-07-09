import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

/// Barras animadas (entram crescendo). Último item destacado com `accent`.
class NavixBarChart extends StatelessWidget {
  const NavixBarChart({
    super.key,
    required this.values,
    required this.labels,
    this.height = 150,
  });

  final List<double> values;
  final List<String> labels;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    final max = values.isEmpty ? 1.0 : values.reduce((a, b) => a > b ? a : b);

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(values.length, (i) {
          final ratio = max <= 0 ? 0.0 : values[i] / max;
          final color = i == values.length - 1 ? t.accent : primary;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: ratio),
                    duration: t.motionSlow,
                    curve: Curves.easeOutCubic,
                    builder: (context, v, child) => Container(
                      height: 8 + v * (height - 30),
                      constraints: const BoxConstraints(maxWidth: 26),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(6),
                          bottom: Radius.circular(3),
                        ),
                      ),
                    ),
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
