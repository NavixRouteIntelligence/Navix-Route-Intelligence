import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

/// Placeholder de carregamento com pulsação suave (estado de loading do DS).
class NavixSkeleton extends StatefulWidget {
  const NavixSkeleton({super.key, this.height = 16, this.width, this.radius = 8});

  final double height;
  final double? width;
  final double radius;

  @override
  State<NavixSkeleton> createState() => _NavixSkeletonState();
}

class _NavixSkeletonState extends State<NavixSkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Criado no initState (não em `late final` preguiçoso): se o widget for
    // descartado sem nunca ter construído, o dispose() criaria o controller
    // sobre um elemento já desativado. Ver _DotState em nav_header.dart.
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.tokens.surfaceAlt;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => Opacity(
        opacity: 0.4 + _controller.value * 0.5,
        child: Container(
          height: widget.height,
          width: widget.width,
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      ),
    );
  }
}
