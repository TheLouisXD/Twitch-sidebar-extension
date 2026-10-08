import { useStoredValue, asBoolean, asRememberSession } from "./useStoredValue.js"
import {
  POLL_INTERVAL_KEY,
  FAVORITES_FIRST_KEY,
  REMEMBER_SESSION_KEY,
  DEFAULT_POLL_INTERVAL,
  normalizePollInterval
} from "../preferences.js"

export function usePreferences() {
  const interval = useStoredValue(POLL_INTERVAL_KEY, DEFAULT_POLL_INTERVAL, normalizePollInterval)
  const favorites = useStoredValue(FAVORITES_FIRST_KEY, false, asBoolean)
  const session = useStoredValue(REMEMBER_SESSION_KEY, true, asRememberSession)
  return {
    pollInterval: interval.value,
    favoritesFirst: favorites.value,
    rememberSession: session.value,
    loading: interval.loading || favorites.loading || session.loading,
    error: interval.error || favorites.error || session.error
  }
}
