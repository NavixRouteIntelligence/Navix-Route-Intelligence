import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/failure_l10n.dart';
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
          organization: _organization.text.trim().isEmpty ? null : _organization.text.trim(),
        ),
        keepConnected: _keepConnected,
        enableBiometric: _useBiometrics,
      );
      // Navegação é feita pela guarda do router ao mudar a sessão.
    } on Failure catch (f) {
      if (!mounted) return;
      setState(() => _error = context.failureText(f));
    } catch (_) {
      if (mounted) setState(() => _error = AppLocalizations.of(context).errorUnknown);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.loginTitle, style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 4),
                    Text(l10n.loginSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: InputDecoration(labelText: l10n.fieldEmail),
                      validator: (v) => (v == null || !v.contains('@')) ? '—' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(labelText: l10n.fieldPassword),
                      validator: (v) => (v == null || v.length < 8) ? '—' : null,
                    ),
                    const SizedBox(height: 12),
                    // Empresa (opcional): o tenant é resolvido pelo e-mail; este
                    // campo só é necessário para desambiguar (ADR-0016).
                    TextFormField(
                      controller: _organization,
                      autofillHints: const [AutofillHints.organizationName],
                      decoration: const InputDecoration(labelText: 'Empresa (opcional)'),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l10n.keepConnected),
                      value: _keepConnected,
                      onChanged: (v) => setState(() => _keepConnected = v),
                    ),
                    if (_biometricAvailable)
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(l10n.useBiometrics),
                        value: _useBiometrics,
                        onChanged: _keepConnected ? (v) => setState(() => _useBiometrics = v) : null,
                      ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 16),
                    NavixButton(label: l10n.signInAction, loading: _submitting, onPressed: _submit),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => context.push('/register'),
                      child: Text(l10n.noAccountRegister),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
