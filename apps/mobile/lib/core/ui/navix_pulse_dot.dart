import 'package:flutter/material.dart';

/// Ponto de estado "ao vivo": um círculo sólido que, quando [animate], emite um
/// halo pulsante. Usado no header do menu (Em Rota) e no dashboard (Em rota).
///
/// O controller é criado no `initState` e **nunca** num inicializador
/// `late final` preguiçoso: com `animate: false` o build retorna antes de tocar
/// no controller, e aí o `dispose()` acabava *criando* o `AnimationController`
/// sobre um elemento já desativado — "Looking up a deactivated widget's
/// ancestor is unsafe" — derrubando a árvore inteira do app.
class NavixPulseDot extends StatefulWidget {
  const NavixPulseDot({required this.color, required this.animate, this.size = 8, super.key});

  final Color color;
  final bool animate;
  final double size;

  @override
  State<NavixPulseDot> createState() => _NavixPulseDotState();
}

class _NavixPulseDotState extends State<NavixPulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
    if (widget.animate) _c.repeat();
  }

  @override
  void didUpdateWidget(covariant NavixPulseDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.animate && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final dot = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
    );
    if (!widget.animate) return dot;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => SizedBox(
        width: size,
        height: size,
        child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
          Opacity(
            opacity: (1 - _c.value) * 0.6,
            child: Container(
              width: size + _c.value * (size + 2),
              height: size + _c.value * (size + 2),
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: widget.color)),
            ),
          ),
          child!,
        ]),
      ),
      child: dot,
    );
  }
}
