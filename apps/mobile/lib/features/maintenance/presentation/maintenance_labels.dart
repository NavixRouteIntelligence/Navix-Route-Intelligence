import '../../../l10n/gen/app_localizations.dart';

/// Rótulo localizado do tipo de manutenção.
String maintenanceTypeLabel(AppLocalizations l10n, String type) {
  switch (type) {
    case 'oil_change':
      return l10n.maintTypeOilChange;
    case 'revision':
      return l10n.maintTypeRevision;
    case 'tires':
      return l10n.maintTypeTires;
    case 'insurance':
      return l10n.maintTypeInsurance;
    case 'inspection':
      return l10n.maintTypeInspection;
    case 'ipo':
      return l10n.maintTypeIpo;
    default:
      return l10n.maintTypeOther;
  }
}
