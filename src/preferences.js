import { localGet } from "./platform.js"

export const POLL_INTERVAL_KEY = "pollIntervalMinutes"
export const FAVORITES_FIRST_KEY = "favoritesFirst"
export const DEFAULT_POLL_INTERVAL = 3
export const POLL_INTERVAL_OPTIONS = [1, 2, 3, 5, 10, 15, 30, 60]

export function normalizePollInterval(value) {
  return POLL_INTERVAL_OPTIONS.includes(value) ? value : DEFAULT_POLL_INTERVAL
}

export async function getPreferences() {
  const preferences = await localGet([POLL_INTERVAL_KEY, FAVORITES_FIRST_KEY])
  return {
    pollIntervalMinutes: normalizePollInterval(preferences[POLL_INTERVAL_KEY]),
    favoritesFirst: preferences[FAVORITES_FIRST_KEY] === true,
  }
}

export function orderLiveChannels(channels, favorites, favoritesFirst) {
  // Preserve viewer order within each group without mutating the saved list.
  if (!favoritesFirst) return channels
  return [...channels.filter((channel) => favorites.has(channel.user_id)),
    ...channels.filter((channel) => !favorites.has(channel.user_id))]
}
