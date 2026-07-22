import 'package:flutter/material.dart';

import 'navix_splash.dart';

/// Sobrepõe a [NavixSplash] ao app e a dissolve quando **as duas** condições se
/// cumprem: a encenação terminou **e** os dados iniciais chegaram.
///
/// - Dados prontos antes da animação → a animação termina normalmente.
/// - Animação pronta antes dos dados → o movimento ambiente (respiração,
///   órbita, parallax) segue em loop, sem barra de progresso nem sensação de
///   espera, até os dados chegarem.
///
/// Fica **acima** do roteador (via `MaterialApp.builder`), então não toca em
/// rotas, guardas de sessão nem regras de negócio: o app já está montado e
/// carregando por baixo enquanto a abertura acontece.
class SplashGate extends StatefulWidget {
  const SplashGate({
    required this.child,
    required this.isDataReady,
    this.exitDuration = const Duration(milliseconds: 520),
    super.key,
  });

  final Widget child;

  /// `true` quando o carregamento inicial terminou (ex.: sessão restaurada).
  final bool isDataReady;

  final Duration exitDuration;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> with SingleTickerProviderStateMixin {
  late final AnimationController _exit;
  bool _storyDone = false;

  @override
  void initState() {
    super.initState();
    _exit = AnimationController(vsync: this, duration: widget.exitDuration);
  }

  @override
  void didUpdateWidget(covariant SplashGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    _maybeExit();
  }

  void _onStorytellingDone() {
    _storyDone = true;
    _maybeExit();
  }

  void _maybeExit() {
    if (!_storyDone || !widget.isDataReady) return;
    if (_exit.status == AnimationStatus.dismissed) _exit.forward();
  }

  @override
  void dispose() {
    _exit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _exit,
      builder: (context, _) {
        final t = _exit.value;
        if (t >= 1) return widget.child;

        final fade = Curves.easeInOut.transform(t);
        return Stack(
          fit: StackFit.expand,
          children: [
            // O app entra crescendo de leve, como se a splash "abrisse" nele.
            Opacity(
              opacity: fade,
              child: Transform.scale(scale: 0.985 + 0.015 * fade, child: widget.child),
            ),
            IgnorePointer(
              child: Opacity(
                opacity: 1 - fade,
                // A splash recua em profundidade ao sair (Fade + Scale).
                child: Transform.scale(
                  scale: 1 + 0.06 * fade,
                  child: NavixSplash(onStorytellingDone: _onStorytellingDone),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
