import { useEffect, useState } from "react"
import LoginPage from "./pages/LoginPage.jsx"
import MainPage from "./pages/MainPage.jsx"
import SettingsPage from "./pages/SettingsPage.jsx"
import NotificationsPage from "./pages/NotificationsPage.jsx"
import ThemesPage from "./pages/ThemesPage.jsx"
import { extension, sendMessage } from "./platform.js"
import { useI18n } from "./i18n-context.js"
import SessionStatus from "./components/SessionStatus.jsx"
import { useStoredValue, asBoolean } from "./hooks/useStoredValue.js"
import { THEME_KEY, DEFAULT_THEME, normalizeTheme } from "./preferences.js"

export default function App() {
  const { t } = useI18n()
  const [authenticated, setAuthenticated] = useState(undefined)
  const [page, setPage] = useState("main")
  const { value: showOffline } = useStoredValue("showOffline", false, asBoolean)
  const { value: theme } = useStoredValue(THEME_KEY, DEFAULT_THEME, normalizeTheme)
  const [error, setError] = useState(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    let active = true
    let sessionChanged = false
    const onStorageChanged = (changes, area) => {
      if (area === "session" && changes.twitch_access_token) {
        sessionChanged = true
        setAuthenticated(Boolean(changes.twitch_access_token.newValue))
        setError(null)
        if (!changes.twitch_access_token.oldValue || !changes.twitch_access_token.newValue)
          setPage("main")
      }
    }
    extension.storage.onChanged.addListener(onStorageChanged)
    sendMessage({ type: "SESSION_RESTORE" })
      .then((result) => {
        if (active && !sessionChanged) setAuthenticated(result.authenticated)
      })
      .catch((failure) => {
        if (active && !sessionChanged) {
          if (failure.code === "AUTH_REQUIRED") setAuthenticated(false)
          setError(failure.message)
        }
      })
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [restoreAttempt])

  function handleLogin() {
    setError(null)
    setPage("main")
    setAuthenticated(true)
  }

  async function handleLogout() {
    try {
      await sendMessage({ type: "SESSION_LOGOUT" })
      setAuthenticated(false)
      setPage("main")
      setError(null)
    } catch (failure) {
      setError(failure.message)
    }
  }

  if (authenticated === undefined) {
    return (
      <SessionStatus
        error={error}
        onLogout={handleLogout}
        onRetry={() => {
          setError(null)
          setRestoreAttempt((attempt) => attempt + 1)
        }}
      />
    )
  }
  if (!authenticated) return <LoginPage onLogin={handleLogin} initialError={error} />

  return (
    <>
      {error && (
        <div className="main-error-banner" role="alert">
          {t("session.error")}
        </div>
      )}
      {page === "notifications" ? (
        <NotificationsPage onBack={() => setPage("settings")} />
      ) : page === "themes" ? (
        <ThemesPage onBack={() => setPage("settings")} />
      ) : page === "settings" ? (
        <SettingsPage
          onLogout={handleLogout}
          onBack={() => setPage("main")}
          showOffline={showOffline}
          onNotifications={() => setPage("notifications")}
          onThemes={() => setPage("themes")}
        />
      ) : (
        <MainPage onSettings={() => setPage("settings")} showOffline={showOffline} />
      )}
    </>
  )
}
