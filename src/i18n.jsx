import { createContext, useContext, useEffect, useState } from "react"

// ── Translations ─────────────────────────────────────────────

const translations = {
  es: {
    // Login
    "login.subtitle": "Conecta tu cuenta para ver los canales que sigues en vivo.",
    "login.button": "Iniciar sesión",
    "login.connecting": "Conectando...",
    "login.error": "No se pudo iniciar sesión.",
    "login.privacy": "Solo se solicita acceso de lectura a tus follows.",
    "login.debug.title": "🔧 Probable causa: Redirect URI no registrada",
    "login.debug.text": "En el",
    "login.debug.add": ", añade esta URL exactamente en",
    "login.debug.verify": "También verifica en el inspector del Service Worker (chrome://extensions → Detalles → Service Worker) si hay más errores.",
    "login.debug.copy": "Click para copiar",

    // Main
    "main.loading": "Cargando canales...",
    "main.live": "En vivo",
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
    "settings.showOffline": "Mostrar canales offline",
    "settings.showOfflineTooltip": "(Puede aumentar tiempos de carga)",
  },

  en: {
    // Login
    "login.subtitle": "Connect your account to see the channels you follow that are live.",
    "login.button": "Sign in",
    "login.connecting": "Connecting...",
    "login.error": "Could not sign in.",
    "login.privacy": "Only read access to your follows is requested.",
    "login.debug.title": "🔧 Likely cause: Redirect URI not registered",
    "login.debug.text": "In the",
    "login.debug.add": ", add this URL exactly in",
    "login.debug.verify": "Also check the Service Worker inspector (chrome://extensions → Details → Service Worker) for more errors.",
    "login.debug.copy": "Click to copy",

    // Main
    "main.loading": "Loading channels...",
    "main.live": "Live",
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
    "settings.showOffline": "Show offline channels",
    "settings.showOfflineTooltip": "(May increase load times)",
  },
}

// ── Context ──────────────────────────────────────────────────

const I18nContext = createContext()

export function I18nProvider({ children }) {
  const [lang, setLang] = useState("es") // default Spanish

  // Load saved language preference on mount
  useEffect(() => {
    chrome.storage.local.get("language", (res) => {
      if (res.language && translations[res.language]) {
        setLang(res.language)
      }
    })
  }, [])

  // Save language preference when changed
  function changeLang(newLang) {
    setLang(newLang)
    chrome.storage.local.set({ language: newLang })
  }

  // Translation function — supports string keys and function keys (for interpolation)
  function t(key, ...args) {
    const val = translations[lang]?.[key] ?? translations.es[key] ?? key
    return typeof val === "function" ? val(...args) : val
  }

  return (
    <I18nContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
