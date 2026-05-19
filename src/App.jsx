import { useEffect, useState } from "react"
import LoginPage from "./pages/LoginPage"
import MainPage from "./pages/MainPage"

export default function App() {
  const [token, setToken] = useState(undefined) // undefined = still loading

  // On mount: restore saved token
  useEffect(() => {
    chrome.storage.local.get("twitch_token", ({ twitch_token }) => {
      setToken(twitch_token ?? null)
    })
  }, [])

  function handleLogin(newToken) {
    setToken(newToken)
  }

  function handleLogout() {
    chrome.storage.local.remove("twitch_token")
    setToken(null)
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

  return <MainPage token={token} onLogout={handleLogout} />
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