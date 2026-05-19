import { useEffect, useState } from "react"
import { launchTwitchAuth } from "../auth"
import "./LoginPage.css"

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [redirectUrl, setRedirectUrl] = useState(null)
  const [showDebug, setShowDebug] = useState(false)

  // Fetch the redirect URL from background so the user can verify it's registered
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "TWITCH_GET_REDIRECT_URL" }, (res) => {
      if (res?.redirectUrl) setRedirectUrl(res.redirectUrl)
    })
  }, [])

  function handleLogin() {
    setLoading(true)
    setError(null)
    launchTwitchAuth()
      .then((token) => {
        chrome.storage.local.set({ twitch_token: token })
        onLogin(token)
      })
      .catch((e) => {
        console.error("Auth error:", e)
        setError(e.message || "No se pudo iniciar sesión.")
        setLoading(false)
        setShowDebug(true)
      })
  }

  return (
    <div className="login-root">
      <div className="login-blob-1" />
      <div className="login-blob-2" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
        </div>

        <h1 className="login-title">Twitch Sidebar</h1>
        <p className="login-subtitle">
          Conecta tu cuenta para ver los canales que sigues en vivo.
        </p>

        {/* Error box */}
        {error && (
          <div className="login-error-box">
            <span>⚠ {error}</span>
          </div>
        )}

        {/* Debug panel — shown after failure */}
        {showDebug && redirectUrl && (
          <div className="login-debug-box">
            <p className="login-debug-title">🔧 Probable causa: Redirect URI no registrada</p>
            <p className="login-debug-text">
              En el{" "}
              <a
                href="#"
                className="login-link"
                onClick={() =>
                  chrome.tabs.create({ url: "https://dev.twitch.tv/console/apps" })
                }
              >
                Twitch Developer Console
              </a>
              , añade esta URL exactamente en <strong>OAuth Redirect URLs</strong>:
            </p>
            <div
              className="login-url-box"
              title="Click para copiar"
              onClick={() => navigator.clipboard.writeText(redirectUrl)}
            >
              <span className="login-url-text">{redirectUrl}</span>
              <span className="login-copy-hint">📋</span>
            </div>
            <p className="login-debug-text login-debug-text--mt">
              También verifica en el inspector del Service Worker (chrome://extensions → Detalles → Service Worker) si hay más errores.
            </p>
          </div>
        )}

        {/* Login button */}
        <button
          id="login-btn"
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="login-btn-content">
              <span className="login-spinner" /> Conectando...
            </span>
          ) : (
            <span className="login-btn-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Iniciar sesión en Twitch
            </span>
          )}
        </button>

        <p className="login-privacy-note">Solo se solicita acceso de lectura a tus follows.</p>
      </div>
    </div>
  )
}
