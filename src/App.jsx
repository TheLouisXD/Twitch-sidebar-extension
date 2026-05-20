import { useEffect, useState } from "react"
import LoginPage from "./pages/LoginPage"
import MainPage from "./pages/MainPage"
import SettingsPage from "./pages/SettingsPage"
import { refreshAccessToken } from "./auth"
import { clearAllCache } from "./cache"

export default function App() {
  const [token, setToken]               = useState(undefined) // undefined = still loading
  const [refreshToken, setRefreshToken] = useState(null)
  const [page, setPage]                 = useState("main")     // "main" | "settings"

  /** Validate a token with Twitch's OAuth endpoint (lightweight, no API quota) */
  async function validateToken(accessToken) {
    try {
      const res = await fetch("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${accessToken}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  /** Try to refresh tokens silently; on failure, clear everything and show login */
  async function silentRefresh(storedRefreshToken) {
    try {
      const result = await refreshAccessToken(storedRefreshToken)
      chrome.storage.session.set({ twitch_access_token: result.access_token })
      chrome.storage.local.set({ twitch_refresh_token: result.refresh_token })
      setToken(result.access_token)
      setRefreshToken(result.refresh_token)
    } catch (e) {
      console.error("Silent refresh failed:", e)
      chrome.storage.local.remove("twitch_refresh_token")
      chrome.storage.session.remove("twitch_access_token")
      setToken(null)
    }
  }

  // On mount: restore saved tokens
  // - access_token  → chrome.storage.session (cleared when browser closes)
  // - refresh_token → chrome.storage.local   (persists for silent re-auth)
  useEffect(() => {
    Promise.all([
      new Promise((r) => chrome.storage.session.get("twitch_access_token",  (res) => r(res.twitch_access_token  ?? null))),
      new Promise((r) => chrome.storage.local.get("twitch_refresh_token",   (res) => r(res.twitch_refresh_token ?? null))),
    ]).then(async ([accessToken, storedRefreshToken]) => {
      if (accessToken) {
        // Validate the session token with Twitch before using it
        const valid = await validateToken(accessToken)
        if (valid) {
          setToken(accessToken)
          setRefreshToken(storedRefreshToken)
        } else if (storedRefreshToken) {
          await silentRefresh(storedRefreshToken)
        } else {
          chrome.storage.session.remove("twitch_access_token")
          setToken(null)
        }
      } else if (storedRefreshToken) {
        await silentRefresh(storedRefreshToken)
      } else {
        setToken(null)
      }
    })
  }, [])

  function handleLogin(accessToken, newRefreshToken) {
    // Save access_token in session storage (cleared on browser close)
    chrome.storage.session.set({ twitch_access_token: accessToken })
    // Save refresh_token in local storage (persists for silent re-auth)
    chrome.storage.local.set({ twitch_refresh_token: newRefreshToken })
    setToken(accessToken)
    setRefreshToken(newRefreshToken)
  }

  function handleLogout() {
    // Clear all tokens
    chrome.storage.session.remove("twitch_access_token")
    chrome.storage.local.remove("twitch_refresh_token")
    // Clear cached channel/profile data (security: no user data lingers)
    clearAllCache()
    // Clear badge
    chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 })
    setToken(null)
    setRefreshToken(null)
    setPage("main")
  }

  // Handle token refresh from MainPage (when API returns 401)
  async function handleTokenRefresh() {
    if (!refreshToken) {
      handleLogout()
      return null
    }
    try {
      const result = await refreshAccessToken(refreshToken)
      chrome.storage.session.set({ twitch_access_token: result.access_token })
      chrome.storage.local.set({ twitch_refresh_token: result.refresh_token })
      setToken(result.access_token)
      setRefreshToken(result.refresh_token)
      return result.access_token
    } catch (e) {
      console.error("Token refresh failed:", e)
      handleLogout()
      return null
    }
  }

  // Still restoring session
  if (token === undefined) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return page === "settings" ? (
    <SettingsPage
      token={token}
      onLogout={handleLogout}
      onBack={() => setPage("main")}
    />
  ) : (
    <MainPage
      token={token}
      onLogout={handleLogout}
      onTokenRefresh={handleTokenRefresh}
      onSettings={() => setPage("settings")}
    />
  )
}

const loadingStyle = {
  width: "100%",
  height: "100vh",
  background: "#0e0e10",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const spinnerStyle = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "3px solid #1f1f23",
  borderTop: "3px solid #9147ff",
  animation: "spin 0.8s linear infinite",
}