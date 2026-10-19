import { localGet } from "./platform.js"

export const POLL_INTERVAL_KEY = "pollIntervalMinutes"
export const REMEMBER_SESSION_KEY = "rememberSession"
export const THEME_KEY = "theme"
export const ACCENT_KEY = "accentColor"
export const DEFAULT_POLL_INTERVAL = 3
export const DEFAULT_THEME = "default"
export const DEFAULT_ACCENT = null
export const POLL_INTERVAL_OPTIONS = [1, 2, 3, 5, 10, 15, 30, 60]
export const THEME_OPTIONS = ["default", "gx"]
export const ACCENT_OPTIONS = ["red", "blue", "purple", "yellow", "orange", "green", "sky"]

export const THEMES = [
  {
    id: "default",
    nameKey: "settings.themeDefault",
    previewUrl: "" // Espacio para la foto del tema
  },
  {
    id: "gx",
    nameKey: "settings.themeGx",
    previewUrl: "" // Espacio para la foto del tema
  }
]

// Until the user picks a color, each theme keeps the accent it already had.
export const DEFAULT_ACCENTS = { default: "purple", gx: "red" }

function accentVars(base, hover, light, dark, onAccent, glow) {
  return {
    "--tw-accent": base,
    "--tw-accent-hover": hover,
    "--tw-accent-light": light,
    "--tw-accent-dark": dark,
    "--tw-accent-gradient": `linear-gradient(135deg, ${base}, ${dark})`,
    "--tw-accent-glow": `rgba(${glow}, 0.3)`,
    "--tw-accent-glow-strong": `rgba(${glow}, 0.55)`,
    "--tw-on-accent": onAccent
  }
}

export const ACCENTS = [
  {
    id: "red",
    nameKey: "themes.accentRed",
    vars: accentVars("#fa1e4e", "#ff3b68", "#ff6b8a", "#a01231", "#ffffff", "250, 30, 78")
  },
  {
    id: "blue",
    nameKey: "themes.accentBlue",
    vars: accentVars("#2563eb", "#3b82f6", "#60a5fa", "#1e3a8a", "#ffffff", "37, 99, 235")
  },
  {
    id: "purple",
    nameKey: "themes.accentPurple",
    vars: accentVars("#9147ff", "#a25ceb", "#a970ff", "#6030a8", "#ffffff", "145, 71, 255")
  },
  {
    id: "yellow",
    nameKey: "themes.accentYellow",
    vars: accentVars("#eab308", "#facc15", "#fde047", "#a16207", "#000000", "234, 179, 8")
  },
  {
    id: "orange",
    nameKey: "themes.accentOrange",
    vars: accentVars("#ea580c", "#f97316", "#fdba74", "#9a3412", "#000000", "234, 88, 12")
  },
  {
    id: "green",
    nameKey: "themes.accentGreen",
    vars: accentVars("#22c55e", "#4ade80", "#86efac", "#15803d", "#000000", "34, 197, 94")
  },
  {
    id: "sky",
    nameKey: "themes.accentSky",
    vars: accentVars("#0ea5e9", "#38bdf8", "#7dd3fc", "#0369a1", "#000000", "14, 165, 233")
  }
]

export function normalizePollInterval(value) {
  return POLL_INTERVAL_OPTIONS.includes(value) ? value : DEFAULT_POLL_INTERVAL
}

export function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value) ? value : DEFAULT_THEME
}

export function normalizeAccent(value) {
  return ACCENT_OPTIONS.includes(value) ? value : DEFAULT_ACCENT
}

export function getEffectiveAccent(value, theme) {
  return normalizeAccent(value) ?? DEFAULT_ACCENTS[theme] ?? DEFAULT_ACCENTS.default
}

export function getAccentVars(value) {
  return ACCENTS.find((accent) => accent.id === value)?.vars ?? null
}

/** @returns {Promise<import("./types.js").Preferences>} */
export async function getPreferences() {
  const preferences = await localGet([
    POLL_INTERVAL_KEY,
    REMEMBER_SESSION_KEY,
    THEME_KEY,
    ACCENT_KEY
  ])
  return {
    pollIntervalMinutes: normalizePollInterval(preferences[POLL_INTERVAL_KEY]),
    rememberSession: preferences[REMEMBER_SESSION_KEY] !== false,
    theme: normalizeTheme(preferences[THEME_KEY]),
    accentColor: normalizeAccent(preferences[ACCENT_KEY])
  }
}
