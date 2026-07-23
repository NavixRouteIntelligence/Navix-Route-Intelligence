import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/failure.dart';
import '../../../core/error/failure_l10n.dart';
import '../../../core/session/session_cubit.dart';
import '../../../core/ui/navix_button.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/auth_entities.dart';

/// Cadastro com seleção de perfil (Motorista Autônomo × Empresa).
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _company = TextEditingController();

  AccountType _type = AccountType.driver;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _company.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await GetIt.instance<SessionCubit>().register(
        RegisterParams(
          accountType: _type,
          name: _name.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
          organizationName: _type == AccountType.company ? _company.text.trim() : null,
        ),
      );
    } on Failure catch (f) {
      if (mounted) setState(() => _error = context.failureText(f));
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
      appBar: AppBar(title: Text(l10n.registerTitle)),
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
                    Text(l10n.registerSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 16),
                    _TypeSelector(
                      value: _type,
                      driverLabel: l10n.accountDriver,
                      companyLabel: l10n.accountCompany,
                      onChanged: (t) => setState(() => _type = t),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _name,
                      decoration: InputDecoration(labelText: l10n.fieldName),
                      validator: (v) => (v == null || v.trim().length < 2) ? '—' : null,
                    ),
                    if (_type == AccountType.company) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _company,
                        decoration: InputDecoration(labelText: l10n.fieldCompanyName),
                        validator: (v) =>
                            (_type == AccountType.company && (v == null || v.trim().length < 2)) ? '—' : null,
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(labelText: l10n.fieldEmail),
                      validator: (v) => (v == null || !v.contains('@')) ? '—' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      decoration: InputDecoration(labelText: l10n.fieldPassword),
                      validator: (v) => (v == null || v.length < 8) ? '—' : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 16),
                    NavixButton(label: l10n.createAccount, loading: _submitting, onPressed: _submit),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => context.pop(),
                      child: Text(l10n.haveAccountLogin),
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

class _TypeSelector extends StatelessWidget {
  const _TypeSelector({
    required this.value,
    required this.driverLabel,
    required this.companyLabel,
    required this.onChanged,
  });

  final AccountType value;
  final String driverLabel;
  final String companyLabel;
  final ValueChanged<AccountType> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _Option(
            icon: Icons.local_shipping_outlined,
            label: driverLabel,
            selected: value == AccountType.driver,
            onTap: () => onChanged(AccountType.driver),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _Option(
            icon: Icons.apartment_outlined,
            label: companyLabel,
            selected: value == AccountType.company,
            onTap: () => onChanged(AccountType.company),
          ),
        ),
      ],
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({required this.icon, required this.label, required this.selected, required this.onTap});

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? scheme.primary : scheme.outlineVariant, width: selected ? 2 : 1),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? scheme.primary : scheme.onSurfaceVariant),
            const SizedBox(height: 8),
            Text(label, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
