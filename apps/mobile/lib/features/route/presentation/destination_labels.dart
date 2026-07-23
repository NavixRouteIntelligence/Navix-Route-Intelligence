import 'package:flutter/material.dart';

import '../../../l10n/gen/app_localizations.dart';

/// Rótulo e ícone de cada categoria de destino.
///
/// Usa **ícones do Material**, não emoji: o Navix DS é iconográfico em todas as
/// telas, e emoji renderizam diferente em cada plataforma (e desalinham com a
/// tipografia). A intenção do briefing — categorias reconhecíveis num relance —
/// se mantém.
///
/// Categoria desconhecida cai no genérico em vez de estourar: o backend pode
/// acrescentar tipos sem quebrar o app.
IconData destinationIcon(String type) => switch (type) {
      'commerce' => Icons.storefront_outlined,
      'residence' => Icons.home_outlined,
      'apartment' => Icons.apartment_outlined,
      'condo' => Icons.location_city_outlined,
      'company' => Icons.business_center_outlined,
      'hospital' => Icons.local_hospital_outlined,
      'mall' => Icons.shopping_bag_outlined,
      _ => Icons.place_outlined,
    };

String destinationLabel(AppLocalizations l10n, String type) => switch (type) {
      'commerce' => l10n.destCommerce,
      'residence' => l10n.destResidence,
      'apartment' => l10n.destApartment,
      'condo' => l10n.destCondo,
      'company' => l10n.destCompany,
      'hospital' => l10n.destHospital,
      'mall' => l10n.destMall,
      _ => l10n.destOther,
    };
