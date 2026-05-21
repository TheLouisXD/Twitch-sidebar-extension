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
        <div className="login-box">
            <img className="login-logo" src="/icons/icon128.png" alt="Twitch Sidebar Icon" />
            <h1 className="login-title">Twitch Sidebar</h1>
            <p className="login-subtitle">{t("login.subtitle")}</p>

        {/* Error box
        {error && (
          <div className="login-error-box">
            <span>⚠ {error}</span>
          </div>
        )}

        {/* Debug panel — shown after failure */}
        {/* {showDebug && redirectUrl && (
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
        )} */}

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
                {t("login.button")}
              </span>
            )}
          </button>
        </div>
    </div>
  )
}
