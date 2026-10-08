import { useEffect, useState } from "react"
import LoginPage from "./pages/LoginPage"
import MainPage from "./pages/MainPage"
import SettingsPage from "./pages/SettingsPage"
import NotificationsPage from "./pages/NotificationsPage"
import { extension, localGet, sendMessage } from "./platform.js"
import { useI18n } from "./i18n-context.js"

export default function App() {
  const { t } = useI18n()
  const [token, setToken] = useState(undefined)
  const [page, setPage] = useState("main")
  const [showOffline, setShowOffline] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const onStorageChanged = (changes, area) => {
      if (area === "session" && changes.twitch_access_token) {
        setToken(changes.twitch_access_token.newValue ?? null)
      }
      if (area === "local" && changes.showOffline) setShowOffline(Boolean(changes.showOffline.newValue))
    }
    extension.storage.onChanged.addListener(onStorageChanged)
    localGet("showOffline").then((result) => {
      if (active) setShowOffline(Boolean(result.showOffline))
    }).catch(console.error)
    sendMessage({ type: "SESSION_RESTORE" }).then((result) => {
      if (active) setToken(result.access_token)
    }).catch((failure) => {
      if (active) {
        setError(failure.message)
        setToken(null)
      }
    })
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [])

  function handleLogin(accessToken) {
    setError(null)
    setPage("main")
    setToken(accessToken)
  }

  async function handleLogout() {
    try {
      await sendMessage({ type: "SESSION_LOGOUT" })
      setToken(null)
      setPage("main")
      setError(null)
    } catch (failure) {
      setError(failure.message)
    }
  }

  if (token === undefined) {
    return <div style={loadingStyle}><div style={spinnerStyle} /></div>
  }
  if (!token) return <LoginPage onLogin={handleLogin} initialError={error} />

  return (
    <>
      {error && <div className="main-error-banner" role="alert">{t("session.error")}</div>}
      {page === "notifications" ? (
        <NotificationsPage onBack={() => setPage("settings")} />
      ) : page === "settings" ? (
        <SettingsPage onLogout={handleLogout} onBack={() => setPage("main")}
          showOffline={showOffline} onShowOfflineChange={setShowOffline}
          onNotifications={() => setPage("notifications")} />
      ) : (
        <MainPage onSettings={() => setPage("settings")} showOffline={showOffline} />
      )}
    </>
  )
}

const loadingStyle = {
  width: "100%", height: "100vh", background: "#0e0e10", display: "flex",
  alignItems: "center", justifyContent: "center",
}
const spinnerStyle = {
  width: 32, height: 32, borderRadius: "50%", border: "3px solid #1f1f23",
  borderTop: "3px solid #9147ff", animation: "spin 0.8s linear infinite",
}
