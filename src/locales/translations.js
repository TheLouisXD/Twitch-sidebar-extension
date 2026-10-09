export const translations = {
  es: {
    "common.retry": "Reintentar",
    "main.loadError": "No se pudieron actualizar los canales.",
    "session.error": "No se pudo actualizar la sesión.",
    "session.recovery": "No se pudo comprobar tu sesión. Revisa la conexión e inténtalo de nuevo.",
    "settings.error": "No se pudo cargar el perfil.",
    "settings.saveError": "No se pudieron cargar o guardar las preferencias. Inténtalo de nuevo.",
    "notifications.error": "No se pudieron actualizar los favoritos.",
    // Login
    "login.subtitle": "Conecta tu cuenta para ver los canales que sigues en vivo.",
    "login.button": "Iniciar sesión",
    "login.connecting": "Conectando...",
    "login.error": "No se pudo iniciar sesión.",
    "login.privacy": "Solo se solicita acceso de lectura a tus follows.",
    "login.dataUse":
      "Al iniciar sesión, tu identificador de cuenta se envía a Twitch y las credenciales OAuth al servicio de autenticación de la extensión para mantener la sesión.",

    // Main
    "main.loading": "Cargando canales...",
    "main.live": "En vivo",
    "main.liveCount": "Total de canales en vivo",
    "main.offline": "Offline",
    "main.noResults": (q) => `Sin resultados para "${q}".`,
    "main.noLive": "Ningún canal en vivo ahora.",
    "main.settings": "Configuración",

    // Search
    "search.placeholder": "Buscar canal...",

    // TwitchCard
    "card.offline": "Offline",
    "card.openChannel": (name) => `Abrir el canal de ${name}`,

    // Settings
    "settings.title": "Configuración",
    "settings.back": "Volver",
    "settings.account": "Cuenta",
    "settings.followers": "Seguidores",
    "settings.type": "Tipo",
    "settings.created": "Creada",
    "settings.logout": "Cerrar sesión",
    "settings.partner": "Partner",
    "settings.affiliate": "Afiliado",
    "settings.standard": "Estándar",
    "settings.language": "Idioma",
    "settings.theme": "Tema",
    "settings.themeDefault": "Por defecto",
    "settings.themeGx": "GX",
    "settings.preferences": "Preferencias",
    "settings.refreshInterval": "Actualizar cada",
    "settings.refreshIntervalHint": "Actualiza la lista y el contador en segundo plano.",
    "settings.minutes": (minutes) => `${minutes} min`,
    "settings.favoritesFirst": "Favoritos en vivo primero",
    "settings.favoritesFirstHint":
      "Los canales marcados como favoritos aparecen arriba cuando están en vivo.",
    "settings.rememberSession": "Recordar sesión",
    "settings.rememberSessionHint": "Mantiene la conexión al cerrar y volver a abrir el navegador.",
    "settings.showOffline": "Mostrar canales offline",
    "settings.showOfflineTooltip": "Muestra los canales que no están emitiendo.",
    "settings.notifications": "Canales favoritos",

    // Notifications page -> Favorites
    "notifications.title": "Canales favoritos",
    "notifications.empty": "No tienes canales favoritos guardados.",
    "notifications.emptyHint": "Marca la ⭐ en cualquier canal para agregarlo a favoritos.",
    "notifications.remove": "Quitar",
    "notifications.removeLabel": (name) => `Quitar a ${name} de favoritos`,
    "notifications.unknownChannel": (id) => `Canal ${id}`,
    "notifications.bell.activate": "Marcar como favorito",
    "notifications.bell.deactivate": "Quitar de favoritos",

    // Themes page
    "themes.title": "Temas",
    "themes.active": "Activo",
    "themes.select": "Seleccionar"
  },

  en: {
    "common.retry": "Retry",
    "main.loadError": "Could not update channels.",
    "session.error": "Could not update the session.",
    "session.recovery": "Could not check your session. Check your connection and try again.",
    "settings.error": "Could not load the profile.",
    "settings.saveError": "Could not load or save preferences. Please try again.",
    "notifications.error": "Could not update favorites.",
    // Login
    "login.subtitle": "Connect your account to see the channels you follow that are live.",
    "login.button": "Sign in",
    "login.connecting": "Connecting...",
    "login.error": "Could not sign in.",
    "login.privacy": "Only read access to your follows is requested.",
    "login.dataUse":
      "Signing in sends your account ID to Twitch and OAuth credentials to the extension's authentication service to maintain your session.",

    // Main
    "main.loading": "Loading channels...",
    "main.live": "Live",
    "main.liveCount": "Total live channels",
    "main.offline": "Offline",
    "main.noResults": (q) => `No results for "${q}".`,
    "main.noLive": "No channels live right now.",
    "main.settings": "Settings",

    // Search
    "search.placeholder": "Search channel...",

    // TwitchCard
    "card.offline": "Offline",
    "card.openChannel": (name) => `Open ${name}'s channel`,

    // Settings
    "settings.title": "Settings",
    "settings.back": "Back",
    "settings.account": "Account",
    "settings.followers": "Followers",
    "settings.type": "Type",
    "settings.created": "Created",
    "settings.logout": "Sign out",
    "settings.partner": "Partner",
    "settings.affiliate": "Affiliate",
    "settings.standard": "Standard",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.themeDefault": "Default",
    "settings.themeGx": "GX",
    "settings.preferences": "Preferences",
    "settings.refreshInterval": "Refresh every",
    "settings.refreshIntervalHint": "Updates the list and live count in the background.",
    "settings.minutes": (minutes) => `${minutes} min`,
    "settings.favoritesFirst": "Live favorites first",
    "settings.favoritesFirstHint": "Channels marked as favorites appear first while live.",
    "settings.rememberSession": "Remember session",
    "settings.rememberSessionHint": "Keeps you signed in after closing and reopening the browser.",
    "settings.showOffline": "Show offline channels",
    "settings.showOfflineTooltip": "Shows channels that are not streaming.",
    "settings.notifications": "Favorite channels",

    // Notifications page -> Favorites
    "notifications.title": "Favorite channels",
    "notifications.empty": "You don't have any favorite channels saved.",
    "notifications.emptyHint": "Mark the ⭐ on any streamer card to add to favorites.",
    "notifications.remove": "Remove",
    "notifications.removeLabel": (name) => `Remove ${name} from favorites`,
    "notifications.unknownChannel": (id) => `Channel ${id}`,
    "notifications.bell.activate": "Add to favorites",
    "notifications.bell.deactivate": "Remove from favorites",

    // Themes page
    "themes.title": "Themes",
    "themes.active": "Active",
    "themes.select": "Select"
  }
}
