import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../app/router/app_router.dart';
import '../../../app/splash/navix_mark.dart';
import '../../../core/security/biometric_service.dart';
import '../../../core/session/session_cubit.dart';
import '../../../core/ui/navix_button.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/auth_entities.dart';

/// Tela de login: e-mail/senha (+ empresa opcional), "manter conectado" e biometria.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _organization = TextEditingController();

  bool _keepConnected = true;
  bool _useBiometrics = false;
  bool _biometricAvailable = false;
  bool _obscurePassword = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    GetIt.instance<BiometricService>().isAvailable().then((v) {
      if (mounted) setState(() => _biometricAvailable = v);
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _organization.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await GetIt.instance<SessionCubit>().login(
        LoginParams(
          email: _email.text.trim(),
          password: _password.text,
          organization: _organization.text.trim().isEmpty
              ? null
              : _organization.text.trim(),
        ),
        keepConnected: _keepConnected,
        enableBiometric: _useBiometrics,
      );
      // Navegação é feita pela guarda do router ao mudar a sessão.
    } on Failure catch (f) {
      if (!mounted) return;
      setState(() => _error = context.failureText(f));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context).errorUnknown);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final background = theme.scaffoldBackgroundColor;
    return Scaffold(
      body: SafeArea(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0, -0.42),
              radius: 1.05,
              colors: [
                Color.lerp(background, colors.primary, 0.17)!,
                background,
              ],
              stops: const [0, 0.72],
            ),
          ),
          child: LayoutBuilder(
            builder: (context, viewport) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: viewport.maxHeight - 48,
                ),
                child: IntrinsicHeight(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Wrap(
                            alignment: WrapAlignment.end,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                l10n.noAccountPrompt,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              TextButton(
                                onPressed: () => context.push('/register'),
                                child: Text(l10n.noAccountRegister),
                              ),
                            ],
                          ),
                          const Spacer(),
                          Material(
                            color: colors.surface,
                            elevation: 8,
                            shadowColor: colors.primary.withValues(alpha: 0.16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                              side: BorderSide(color: colors.outlineVariant),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Form(
                                key: _formKey,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Align(
                                      child: _NavixLoginMark(
                                        primary: colors.primary,
                                        accent: colors.secondary,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      l10n.loginTitle,
                                      textAlign: TextAlign.center,
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall
                                          ?.copyWith(
                                              fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      l10n.loginSubtitle,
                                      textAlign: TextAlign.center,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium,
                                    ),
                                    const SizedBox(height: 22),
                                    TextFormField(
                                      controller: _email,
                                      keyboardType: TextInputType.emailAddress,
                                      autofillHints: const [
                                        AutofillHints.email
                                      ],
                                      decoration: InputDecoration(
                                        labelText: l10n.fieldEmail,
                                        prefixIcon: const Icon(
                                          Icons.alternate_email_rounded,
                                        ),
                                      ),
                                      validator: (v) =>
                                          (v == null || !v.contains('@'))
                                              ? '—'
                                              : null,
                                    ),
                                    const SizedBox(height: 10),
                                    TextFormField(
                                      controller: _password,
                                      obscureText: _obscurePassword,
                                      autofillHints: const [
                                        AutofillHints.password
                                      ],
                                      decoration: InputDecoration(
                                        labelText: l10n.fieldPassword,
                                        prefixIcon: const Icon(
                                          Icons.lock_outline_rounded,
                                        ),
                                        suffixIcon: IconButton(
                                          tooltip: _obscurePassword
                                              ? 'Mostrar palavra-passe'
                                              : 'Ocultar palavra-passe',
                                          onPressed: () => setState(
                                            () => _obscurePassword =
                                                !_obscurePassword,
                                          ),
                                          icon: Icon(
                                            _obscurePassword
                                                ? Icons.visibility_off_outlined
                                                : Icons.visibility_outlined,
                                          ),
                                        ),
                                      ),
                                      validator: (v) =>
                                          (v == null || v.length < 8)
                                              ? '—'
                                              : null,
                                    ),
                                    const SizedBox(height: 10),
                                    // Empresa (opcional): o tenant é resolvido pelo
                                    // e-mail; só é necessário para desambiguar.
                                    TextFormField(
                                      controller: _organization,
                                      autofillHints: const [
                                        AutofillHints.organizationName,
                                      ],
                                      decoration: const InputDecoration(
                                        labelText: 'Empresa (opcional)',
                                        prefixIcon:
                                            Icon(Icons.business_outlined),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    _LoginToggleRow(
                                      label: l10n.keepConnected,
                                      value: _keepConnected,
                                      onChanged: (v) =>
                                          setState(() => _keepConnected = v),
                                    ),
                                    if (_biometricAvailable)
                                      _LoginToggleRow(
                                        label: l10n.useBiometrics,
                                        value: _useBiometrics,
                                        onChanged: _keepConnected
                                            ? (v) => setState(
                                                  () => _useBiometrics = v,
                                                )
                                            : null,
                                      ),
                                    if (_error != null) ...[
                                      const SizedBox(height: 8),
                                      Text(
                                        _error!,
                                        style: TextStyle(color: colors.error),
                                      ),
                                    ],
                                    const SizedBox(height: 16),
                                    NavixButton(
                                      label: l10n.signInAction,
                                      loading: _submitting,
                                      onPressed: _submit,
                                    ),
                                    const SizedBox(height: 10),
                                    // Quem foi convidado por uma frota não cria
                                    // organização nova: entra na que o convidou.
                                    NavixButton(
                                      label: l10n.inviteHaveOne,
                                      variant: NavixButtonVariant.outline,
                                      onPressed: () =>
                                          context.push(Routes.invite),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginToggleRow extends StatelessWidget {
  const _LoginToggleRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 50,
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.fade,
                softWrap: false,
              ),
            ),
            const SizedBox(width: 12),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      );
}

class _NavixLoginMark extends StatelessWidget {
  const _NavixLoginMark({required this.primary, required this.accent});

  final Color primary;
  final Color accent;

  @override
  Widget build(BuildContext context) => Container(
        width: 72,
        height: 72,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [primary, Color.lerp(primary, accent, 0.32)!],
          ),
          boxShadow: [
            BoxShadow(
              color: primary.withValues(alpha: 0.34),
              blurRadius: 24,
              spreadRadius: 1,
            ),
          ],
        ),
        child: CustomPaint(
          painter: _NavixLoginMarkPainter(
            routeColor: Colors.white,
            arrowColor: accent,
          ),
        ),
      );
}

class _NavixLoginMarkPainter extends CustomPainter {
  const _NavixLoginMarkPainter({
    required this.routeColor,
    required this.arrowColor,
  });

  final Color routeColor;
  final Color arrowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final side = size.shortestSide;
    final route = NavixMark.scaleTo(
      NavixMark.routePath(),
      center: center,
      side: side,
    );
    final arrow = NavixMark.scaleTo(
      NavixMark.arrowPath(),
      center: center,
      side: side,
    );

    canvas
      ..drawPath(
        route,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = side * 0.08
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = routeColor,
      )
      ..drawPath(arrow, Paint()..color = arrowColor);
  }

  @override
  bool shouldRepaint(_NavixLoginMarkPainter oldDelegate) =>
      oldDelegate.routeColor != routeColor ||
      oldDelegate.arrowColor != arrowColor;
}
