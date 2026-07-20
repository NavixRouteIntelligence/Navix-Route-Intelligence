import '../../../l10n/gen/app_localizations.dart';

/// Rótulo localizado da categoria financeira.
String financeCategoryLabel(AppLocalizations l10n, String category) {
  switch (category) {
    case 'fuel':
      return l10n.finCategoryFuel;
    case 'maintenance':
      return l10n.finCategoryMaintenance;
    case 'toll':
      return l10n.finCategoryToll;
    case 'delivery':
      return l10n.finCategoryDelivery;
    default:
      return l10n.finCategoryOther;
  }
}
