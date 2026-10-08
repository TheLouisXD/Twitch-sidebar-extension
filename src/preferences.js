import { localGet } from "./platform.js"

export const POLL_INTERVAL_KEY = "pollIntervalMinutes"
export const FAVORITES_FIRST_KEY = "favoritesFirst"
export const REMEMBER_SESSION_KEY = "rememberSession"
export const THEME_KEY = "theme"
export const DEFAULT_POLL_INTERVAL = 3
export const DEFAULT_THEME = "default"
export const POLL_INTERVAL_OPTIONS = [1, 2, 3, 5, 10, 15, 30, 60]
export const THEME_OPTIONS = ["default", "gx"]

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

export function normalizePollInterval(value) {
  return POLL_INTERVAL_OPTIONS.includes(value) ? value : DEFAULT_POLL_INTERVAL
}

export function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value) ? value : DEFAULT_THEME
}

/** @returns {Promise<import("./types.js").Preferences>} */
export async function getPreferences() {
  const preferences = await localGet([
    POLL_INTERVAL_KEY,
    FAVORITES_FIRST_KEY,
    REMEMBER_SESSION_KEY,
    THEME_KEY
  ])
  return {
    pollIntervalMinutes: normalizePollInterval(preferences[POLL_INTERVAL_KEY]),
    favoritesFirst: preferences[FAVORITES_FIRST_KEY] === true,
    rememberSession: preferences[REMEMBER_SESSION_KEY] !== false,
    theme: normalizeTheme(preferences[THEME_KEY])
  }
}

export function orderLiveChannels(channels, favorites, favoritesFirst) {
  // Preserve viewer order within each group without mutating the saved list.
  if (!favoritesFirst) return channels
  return [
    ...channels.filter((channel) => favorites.has(channel.user_id)),
    ...channels.filter((channel) => !favorites.has(channel.user_id))
  ]
}
