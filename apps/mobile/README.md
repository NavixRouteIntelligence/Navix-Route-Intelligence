# Navix Mobile (Flutter)

App do **Motorista** e da **Empresa** (última milha), seguindo a arquitetura
aprovada em [`../../docs/mobile-architecture.md`](../../docs/mobile-architecture.md):
Clean Architecture feature-first, BLoC/Cubit, go_router, get_it, Offline-First
(nas próximas slices), i18n (PT-BR/PT-PT/EN/ES).

> Esta entrega é o **andaime** (fundação): ambiente/flavors, tema + Design System,
> navegação com guarda por perfil, i18n, logging e tratamento global de erros.
> As regras de negócio (Auth real, Rota, POD, Tracking, Sync) entram por slices.

## Pré-requisitos

- Flutter SDK **>= 3.19** (canal stable).

## Primeiro setup

O repositório versiona apenas `lib/`, `test/` e a config. Gere as pastas de
plataforma e o código de localização uma vez:

```bash
cd apps/mobile
flutter create . --project-name navix_mobile --platforms=android,ios,web
flutter pub get
flutter gen-l10n          # gera lib/l10n/gen/app_localizations.dart
```

## Rodar

```bash
# Desenvolvimento (aponta para a API local; no emulador Android use 10.0.2.2)
flutter run -t lib/main_dev.dart

# Produção
flutter run -t lib/main_prod.dart --dart-define=API_BASE_URL=https://api.navix.app/api/v1
```

No login (andaime), escolha **Motorista** ou **Empresa** para ver a casca de
navegação de cada perfil (a integração real de Auth entra depois).

## Qualidade

```bash
flutter analyze
flutter test
```

## Estrutura

```
lib/
  main_dev.dart / main_prod.dart   # entrypoints por flavor
  bootstrap.dart                   # zona protegida + DI + erros globais
  core/
    config/    logging/    error/    di/    session/    ui/
  app/
    app.dart   theme/   router/   shell/ (driver/company)
  features/
    auth/ (login)  …demais features entram por slice
  l10n/arb/ (en, pt_BR, pt_PT, es)
```

## Convenções

- Sem segredos no código — use `--dart-define`.
- `domain` não depende de Flutter; mapeamento DTO↔Entity fica na `data`.
- Toda mutação futura passa pelo Outbox (Offline-First) — ver arquitetura §7–8.
