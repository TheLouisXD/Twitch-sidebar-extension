import { useStoredValue, asRememberSession } from "./useStoredValue.js"
import {
  POLL_INTERVAL_KEY,
  REMEMBER_SESSION_KEY,
  THEME_KEY,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_THEME,
  normalizePollInterval,
  normalizeTheme
} from "../preferences.js"

export function usePreferences() {
  const interval = useStoredValue(POLL_INTERVAL_KEY, DEFAULT_POLL_INTERVAL, normalizePollInterval)
  const session = useStoredValue(REMEMBER_SESSION_KEY, true, asRememberSession)
  const theme = useStoredValue(THEME_KEY, DEFAULT_THEME, normalizeTheme)
  return {
    pollInterval: interval.value,
    rememberSession: session.value,
    theme: theme.value,
    loading: interval.loading || session.loading || theme.loading,
    error: interval.error || session.error || theme.error
  }
}
