import { useEffect, useState } from "react"
import { launchTwitchAuth } from "../auth"
import { useI18n } from "../i18n"
import "./LoginPage.css"

export default function LoginPage({ onLogin }) {
  const { t } = useI18n()
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
      .then(({ access_token, refresh_token }) => {
        onLogin(access_token, refresh_token)
      })
      .catch((e) => {
        console.error("Auth error:", e)
        setError(e.message || t("login.error"))
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
        <p className="login-subtitle">{t("login.subtitle")}</p>

        {/* Error box */}
        {error && (
          <div className="login-error-box">
            <span>⚠ {error}</span>
          </div>
        )}

        {/* Debug panel — shown after failure */}
        {showDebug && redirectUrl && (
          <div className="login-debug-box">
            <p className="login-debug-title">{t("login.debug.title")}</p>
            <p className="login-debug-text">
              {t("login.debug.text")}{" "}
              <a
                href="#"
                className="login-link"
                onClick={() =>
                  chrome.tabs.create({ url: "https://dev.twitch.tv/console/apps" })
                }
              >
                Twitch Developer Console
              </a>
              {t("login.debug.add")} <strong>OAuth Redirect URLs</strong>:
            </p>
            <div
              className="login-url-box"
              title={t("login.debug.copy")}
              onClick={() => navigator.clipboard.writeText(redirectUrl)}
            >
              <span className="login-url-text">{redirectUrl}</span>
              <span className="login-copy-hint">📋</span>
            </div>
            <p className="login-debug-text login-debug-text--mt">
              {t("login.debug.verify")}
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
              <span className="login-spinner" /> {t("login.connecting")}
            </span>
          ) : (
            <span className="login-btn-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              {t("login.button")}
            </span>
          )}
        </button>

        <p className="login-privacy-note">{t("login.privacy")}</p>
      </div>
    </div>
  )
}
