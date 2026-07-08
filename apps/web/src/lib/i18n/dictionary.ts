/**
 * Dicionário de i18n. Cobre as áreas principais (shell, perfil/configurações,
 * estados, páginas de sistema e insights). Quatro locales: PT-BR, PT-PT, EN, ES.
 */
export type Locale = 'pt-BR' | 'pt-PT' | 'en' | 'es';

export const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
  { value: 'pt-PT', label: 'Português (PT)', flag: '🇵🇹' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
];

/** Mapeia o locale para o atributo `lang` do HTML. */
export const HTML_LANG: Record<Locale, string> = {
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  en: 'en',
  es: 'es',
};

const pt_BR = {
  'nav.dashboard': 'Dashboard',
  'nav.deliveries': 'Entregas',
  'nav.imports': 'Importar',
  'nav.drivers': 'Motoristas',
  'nav.vehicles': 'Veículos',
  'nav.optimizer': 'Otimizador',
  'nav.tracking': 'Rastreamento',
  'nav.route': 'Minha rota',
  'nav.myVehicle': 'Meu veículo',
  'nav.profile': 'Perfil',
  'nav.settings': 'Configurações',
  'nav.collapse': 'Recolher',

  'topbar.search': 'Buscar…',
  'topbar.userMenu': 'Menu do usuário',
  'topbar.logout': 'Sair',
  'topbar.openMenu': 'Abrir menu',

  'profile.title': 'Perfil e configurações',
  'profile.subtitle': 'Sua conta, aparência e preferências.',
  'profile.tab.account': 'Conta',
  'profile.tab.appearance': 'Aparência',
  'profile.tab.preferences': 'Preferências',
  'profile.tab.company': 'Empresa',
  'profile.password': 'Alterar senha',

  'settings.theme': 'Tema',
  'settings.theme.light': 'Claro',
  'settings.theme.dark': 'Escuro',
  'settings.theme.system': 'Sistema',
  'settings.language': 'Idioma',
  'settings.company.email': 'E-mail',
  'settings.company.tenant': 'Organização (ID)',
  'settings.company.roles': 'Papéis',
  'settings.pref.reducedMotion': 'Reduzir animações',
  'settings.pref.reducedMotion.hint': 'Desativa transições e animações da interface.',
  'settings.pref.compact': 'Modo compacto',
  'settings.pref.compact.hint': 'Reduz espaçamentos para exibir mais conteúdo.',

  'state.loading': 'Carregando…',
  'state.retry': 'Tentar novamente',
  'state.offline.title': 'Sem conexão',
  'state.offline.description': 'Você está offline. Verifique sua internet — reconectaremos automaticamente.',

  'error.404.title': 'Página não encontrada',
  'error.404.description': 'O endereço que você tentou acessar não existe ou foi movido.',
  'error.403.title': 'Acesso negado',
  'error.403.description': 'Você não tem permissão para acessar esta página.',
  'error.500.title': 'Erro inesperado',
  'error.500.description': 'Ocorreu um erro no aplicativo. Já registramos o problema.',
  'action.home': 'Ir para o início',

  'insights.title': 'AI Insights',
  'insights.subtitle': 'Análises automáticas da sua operação.',
  'insights.empty': 'Sem dados suficientes para gerar insights ainda.',
};

type Keys = typeof pt_BR;

const pt_PT: Keys = {
  ...pt_BR,
  'nav.deliveries': 'Entregas',
  'nav.vehicles': 'Veículos',
  'nav.settings': 'Definições',
  'topbar.search': 'Pesquisar…',
  'topbar.userMenu': 'Menu do utilizador',
  'topbar.logout': 'Terminar sessão',
  'profile.subtitle': 'A sua conta, aparência e preferências.',
  'profile.password': 'Alterar palavra-passe',
  'settings.pref.reducedMotion': 'Reduzir animações',
  'settings.pref.compact': 'Modo compacto',
  'state.loading': 'A carregar…',
  'state.offline.description': 'Está offline. Verifique a sua ligação — reconectaremos automaticamente.',
  'error.404.description': 'O endereço que tentou aceder não existe ou foi movido.',
  'error.403.description': 'Não tem permissão para aceder a esta página.',
  'action.home': 'Ir para o início',
  'insights.subtitle': 'Análises automáticas da sua operação.',
};

const en: Keys = {
  'nav.dashboard': 'Dashboard',
  'nav.deliveries': 'Deliveries',
  'nav.imports': 'Import',
  'nav.drivers': 'Drivers',
  'nav.vehicles': 'Vehicles',
  'nav.optimizer': 'Optimizer',
  'nav.tracking': 'Tracking',
  'nav.route': 'My route',
  'nav.myVehicle': 'My vehicle',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.collapse': 'Collapse',

  'topbar.search': 'Search…',
  'topbar.userMenu': 'User menu',
  'topbar.logout': 'Sign out',
  'topbar.openMenu': 'Open menu',

  'profile.title': 'Profile & settings',
  'profile.subtitle': 'Your account, appearance and preferences.',
  'profile.tab.account': 'Account',
  'profile.tab.appearance': 'Appearance',
  'profile.tab.preferences': 'Preferences',
  'profile.tab.company': 'Company',
  'profile.password': 'Change password',

  'settings.theme': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.language': 'Language',
  'settings.company.email': 'Email',
  'settings.company.tenant': 'Organization (ID)',
  'settings.company.roles': 'Roles',
  'settings.pref.reducedMotion': 'Reduce motion',
  'settings.pref.reducedMotion.hint': 'Disables interface transitions and animations.',
  'settings.pref.compact': 'Compact mode',
  'settings.pref.compact.hint': 'Reduces spacing to show more content.',

  'state.loading': 'Loading…',
  'state.retry': 'Try again',
  'state.offline.title': 'No connection',
  'state.offline.description': "You're offline. Check your internet — we'll reconnect automatically.",

  'error.404.title': 'Page not found',
  'error.404.description': 'The address you tried to reach does not exist or was moved.',
  'error.403.title': 'Access denied',
  'error.403.description': 'You do not have permission to access this page.',
  'error.500.title': 'Unexpected error',
  'error.500.description': 'An application error occurred. We have logged the problem.',
  'action.home': 'Go home',

  'insights.title': 'AI Insights',
  'insights.subtitle': 'Automatic analysis of your operation.',
  'insights.empty': 'Not enough data to generate insights yet.',
};

const es: Keys = {
  'nav.dashboard': 'Panel',
  'nav.deliveries': 'Entregas',
  'nav.imports': 'Importar',
  'nav.drivers': 'Conductores',
  'nav.vehicles': 'Vehículos',
  'nav.optimizer': 'Optimizador',
  'nav.tracking': 'Rastreo',
  'nav.route': 'Mi ruta',
  'nav.myVehicle': 'Mi vehículo',
  'nav.profile': 'Perfil',
  'nav.settings': 'Ajustes',
  'nav.collapse': 'Contraer',

  'topbar.search': 'Buscar…',
  'topbar.userMenu': 'Menú de usuario',
  'topbar.logout': 'Cerrar sesión',
  'topbar.openMenu': 'Abrir menú',

  'profile.title': 'Perfil y ajustes',
  'profile.subtitle': 'Tu cuenta, apariencia y preferencias.',
  'profile.tab.account': 'Cuenta',
  'profile.tab.appearance': 'Apariencia',
  'profile.tab.preferences': 'Preferencias',
  'profile.tab.company': 'Empresa',
  'profile.password': 'Cambiar contraseña',

  'settings.theme': 'Tema',
  'settings.theme.light': 'Claro',
  'settings.theme.dark': 'Oscuro',
  'settings.theme.system': 'Sistema',
  'settings.language': 'Idioma',
  'settings.company.email': 'Correo',
  'settings.company.tenant': 'Organización (ID)',
  'settings.company.roles': 'Roles',
  'settings.pref.reducedMotion': 'Reducir animaciones',
  'settings.pref.reducedMotion.hint': 'Desactiva transiciones y animaciones de la interfaz.',
  'settings.pref.compact': 'Modo compacto',
  'settings.pref.compact.hint': 'Reduce el espaciado para mostrar más contenido.',

  'state.loading': 'Cargando…',
  'state.retry': 'Reintentar',
  'state.offline.title': 'Sin conexión',
  'state.offline.description': 'Estás sin conexión. Revisa tu internet — reconectaremos automáticamente.',

  'error.404.title': 'Página no encontrada',
  'error.404.description': 'La dirección que intentaste abrir no existe o fue movida.',
  'error.403.title': 'Acceso denegado',
  'error.403.description': 'No tienes permiso para acceder a esta página.',
  'error.500.title': 'Error inesperado',
  'error.500.description': 'Ocurrió un error en la aplicación. Ya registramos el problema.',
  'action.home': 'Ir al inicio',

  'insights.title': 'AI Insights',
  'insights.subtitle': 'Análisis automático de tu operación.',
  'insights.empty': 'Aún no hay datos suficientes para generar insights.',
};

export const DICTIONARY: Record<Locale, Keys> = {
  'pt-BR': pt_BR,
  'pt-PT': pt_PT,
  en,
  es,
};

export type TranslationKey = keyof Keys;
