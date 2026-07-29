import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../core/session/session_cubit.dart';
import '../../../core/ui/navix_button.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/auth_entities.dart';
import '../domain/auth_repository.dart';

/// Token base64url de 32 bytes = 43 caracteres (ADR-0082/0085).
final _tokenPattern = RegExp(r'[A-Za-z0-9_-]{43}');

/// Extrai o token de um link inteiro **ou** de um código solto.
///
/// O motorista recebe uma URL por WhatsApp; colar tudo é o gesto natural, e
/// exigir que ele recorte só o código seria atrito gratuito.
String? extractInviteToken(String input) =>
    _tokenPattern.firstMatch(input.trim())?.group(0);

/// Aceite do convite de motorista (ADR-0085).
///
/// Duas etapas: colar o link recebido e, resolvido o convite, criar a conta. O
/// e-mail e a empresa são **mostrados**, nunca escolhidos — quem os define é o
/// token, que é a única credencial desta tela.
class InvitePage extends StatefulWidget {
  const InvitePage({super.key, this.token});

  /// Preenchido quando a tela é aberta por um link direto.
  final String? token;

  @override
  State<InvitePage> createState() => _InvitePageState();
}

class _InvitePageState extends State<InvitePage> {
  final _formKey = GlobalKey<FormState>();
  final _link = TextEditingController();
  final _name = TextEditingController();
  final _license = TextEditingController();
  final _password = TextEditingController();
  final _passwordConfirm = TextEditingController();

  String? _token;
  DriverInvitePreview? _invite;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.token != null) {
      _link.text = widget.token!;
      // Link direto: resolve sozinho, sem pedir que o motorista confirme algo
      // que ele não digitou.
      WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
    }
  }

  @override
  void dispose() {
    _link.dispose();
    _name.dispose();
    _license.dispose();
    _password.dispose();
    _passwordConfirm.dispose();
    super.dispose();
  }

  Future<void> _resolve() async {
    final token = extractInviteToken(_link.text);
    if (token == null) {
      setState(() => _error = AppLocalizations.of(context).inviteNotFound);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final preview =
          await GetIt.instance<AuthRepository>().validateInvite(token);
      if (mounted) {
        setState(() {
          _invite = preview;
          _token = token;
        });
      }
    } on Failure catch (f) {
      if (mounted) setState(() => _error = context.failureText(f));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context).errorUnknown);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept() async {
    if (!_formKey.currentState!.validate()) return;
    final invite = _invite!;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await GetIt.instance<SessionCubit>().acceptInvite(
        AcceptInviteParams(
          token: _token!,
          password: _password.text,
          name: invite.requiresDriverDetails ? _name.text.trim() : null,
          licenseNumber:
              invite.requiresDriverDetails ? _license.text.trim() : null,
        ),
      );
      // A navegação é feita pela guarda do router ao mudar a sessão.
    } on Failure catch (f) {
      if (mounted) setState(() => _error = context.failureText(f));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context).errorUnknown);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final invite = _invite;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.inviteTitle)),
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
                  children: invite == null
                      ? _tokenStep(context, l10n)
                      : _accountStep(context, l10n, invite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _tokenStep(BuildContext context, AppLocalizations l10n) => [
        Text(l10n.inviteSubtitle,
            style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 24),
        TextFormField(
          controller: _link,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: l10n.inviteLinkField,
            helperText: l10n.inviteLinkHint,
            helperMaxLines: 2,
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          _ErrorText(_error!),
        ],
        const SizedBox(height: 16),
        NavixButton(
          label: l10n.inviteContinue,
          loading: _busy,
          onPressed: _resolve,
        ),
      ];

  List<Widget> _accountStep(
    BuildContext context,
    AppLocalizations l10n,
    DriverInvitePreview invite,
  ) =>
      [
        Card(
          child: ListTile(
            leading: const Icon(Icons.verified_outlined),
            title: Text(l10n.inviteInvitedBy),
            subtitle: Text(
              invite.organizationName,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          initialValue: invite.email,
          readOnly: true,
          decoration: InputDecoration(
            labelText: l10n.inviteEmailField,
            helperText: l10n.inviteEmailHint,
            helperMaxLines: 2,
          ),
        ),
        if (invite.requiresDriverDetails) ...[
          const SizedBox(height: 12),
          TextFormField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
            decoration: InputDecoration(labelText: l10n.inviteNameField),
            validator: (v) => (v == null || v.trim().length < 2)
                ? l10n.inviteNameInvalid
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _license,
            decoration: InputDecoration(labelText: l10n.inviteLicenseField),
            validator: (v) => (v == null || v.trim().length < 3)
                ? l10n.inviteLicenseInvalid
                : null,
          ),
        ],
        const SizedBox(height: 12),
        TextFormField(
          controller: _password,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          decoration: InputDecoration(
            labelText: l10n.invitePasswordField,
            helperText: l10n.invitePasswordHint,
          ),
          validator: (v) =>
              (v == null || v.length < 8) ? l10n.invitePasswordShort : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _passwordConfirm,
          obscureText: true,
          decoration: InputDecoration(labelText: l10n.invitePasswordConfirm),
          validator: (v) =>
              v != _password.text ? l10n.invitePasswordMismatch : null,
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          _ErrorText(_error!),
        ],
        const SizedBox(height: 16),
        NavixButton(
          label: l10n.inviteSubmit,
          loading: _busy,
          onPressed: _accept,
        ),
        const SizedBox(height: 8),
        Text(
          l10n.invitePrivacy,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ];
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Text(
        message,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      );
}
