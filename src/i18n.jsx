import { useEffect, useState } from "react"
import { I18nContext } from "./i18n-context.js"
import { extension, localGet, localSet } from "./platform.js"

// ── Translations ─────────────────────────────────────────────

const translations = {
  es: {
    "common.retry": "Reintentar",
    "main.loadError": "No se pudieron actualizar los canales.",
    "session.error": "No se pudo actualizar la sesión.",
    "settings.error": "No se pudo cargar el perfil.",
    "settings.saveError": "No se pudieron cargar o guardar las preferencias. Inténtalo de nuevo.",
    "notifications.error": "No se pudieron actualizar las notificaciones.",
    // Login
    "login.subtitle": "Conecta tu cuenta para ver los canales que sigues en vivo.",
    "login.button": "Iniciar sesión",
    "login.connecting": "Conectando...",
    "login.error": "No se pudo iniciar sesión.",
    "login.privacy": "Solo se solicita acceso de lectura a tus follows.",
    "login.dataUse": "Al iniciar sesión, tu identificador de cuenta se envía a Twitch y las credenciales OAuth al servicio de autenticación de la extensión para mantener la sesión.",
    "login.debug.title": "🔧 Probable causa: Redirect URI no registrada",
    "login.debug.text": "En el",
    "login.debug.add": ", añade esta URL exactamente en",
    "login.debug.verify": "También verifica en el inspector del Service Worker (chrome://extensions → Detalles → Service Worker) si hay más errores.",
    "login.debug.copy": "Click para copiar",

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
    "settings.preferences": "Preferencias",
    "settings.refreshInterval": "Actualizar cada",
    "settings.refreshIntervalHint": "Actualiza la lista y el contador en segundo plano.",
    "settings.minutes": (minutes) => `${minutes} min`,
    "settings.favoritesFirst": "Favoritos en vivo primero",
    "settings.favoritesFirstHint": "Los canales con la campana activada aparecen arriba cuando están en vivo.",
    "settings.showOffline": "Mostrar canales offline",
    "settings.showOfflineTooltip": "(Puede aumentar tiempos de carga)",
    "settings.notifications": "Live notifications",

    // Notifications page
    "notifications.title": "Live notifications",
    "notifications.empty": "No tienes streamers con notificaciones activadas.",
    "notifications.emptyHint": "Activa la 🔔 en cualquier card de streamer.",
    "notifications.remove": "Quitar",
    "notifications.bell.activate": "Activar notificación",
    "notifications.bell.deactivate": "Desactivar notificación",
  },

  en: {
    "common.retry": "Retry",
    "main.loadError": "Could not update channels.",
    "session.error": "Could not update the session.",
    "settings.error": "Could not load the profile.",
    "settings.saveError": "Could not load or save preferences. Please try again.",
    "notifications.error": "Could not update notifications.",
    // Login
    "login.subtitle": "Connect your account to see the channels you follow that are live.",
    "login.button": "Sign in",
    "login.connecting": "Connecting...",
    "login.error": "Could not sign in.",
    "login.privacy": "Only read access to your follows is requested.",
    "login.dataUse": "Signing in sends your account ID to Twitch and OAuth credentials to the extension's authentication service to maintain your session.",
    "login.debug.title": "🔧 Likely cause: Redirect URI not registered",
    "login.debug.text": "In the",
    "login.debug.add": ", add this URL exactly in",
    "login.debug.verify": "Also check the Service Worker inspector (chrome://extensions → Details → Service Worker) for more errors.",
    "login.debug.copy": "Click to copy",

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
    "settings.preferences": "Preferences",
    "settings.refreshInterval": "Refresh every",
    "settings.refreshIntervalHint": "Updates the list and live count in the background.",
    "settings.minutes": (minutes) => `${minutes} min`,
    "settings.favoritesFirst": "Live favorites first",
    "settings.favoritesFirstHint": "Channels with notifications enabled appear first while live.",
    "settings.showOffline": "Show offline channels",
    "settings.showOfflineTooltip": "(May increase load times)",
    "settings.notifications": "Live notifications",

    // Notifications page
    "notifications.title": "Live notifications",
    "notifications.empty": "You don't have any streamers with notifications enabled.",
    "notifications.emptyHint": "Enable the 🔔 on any streamer card.",
    "notifications.remove": "Remove",
    "notifications.bell.activate": "Enable notification",
    "notifications.bell.deactivate": "Disable notification",
  },
}

// ── Context ──────────────────────────────────────────────────

export function I18nProvider({ children }) {
  const [lang, setLang] = useState("en") // default English

  // Load saved language preference on mount
  useEffect(() => {
    let active = true
    localGet("language").then((res) => {
      if (active && res.language && translations[res.language]) {
        setLang(res.language)
      }
    }).catch(console.error)
    const onChanged = (changes, area) => {
      if (area === "local" && translations[changes.language?.newValue]) setLang(changes.language.newValue)
    }
    extension.storage.onChanged.addListener(onChanged)
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  // Save language preference when changed
  function changeLang(newLang) {
    if (!translations[newLang]) return
    setLang(newLang)
    localSet({ language: newLang }).catch(console.error)
  }

  // Translation function — supports string keys and function keys (for interpolation)
  function t(key, ...args) {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? key
    return typeof val === "function" ? val(...args) : val
  }

  return (
    <I18nContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
