import { useState } from "react"
import { launchTwitchAuth } from "../auth.js"
import { useI18n } from "../i18n-context.js"
import "./LoginPage.css"

export default function LoginPage({ onLogin, initialError }) {
  const { t, lang, changeLang } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      await launchTwitchAuth()
      onLogin()
    } catch (failure) {
      console.error("Auth error:", failure.message)
      setError(failure.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <main className="login-box">
        <img className="login-logo" src="./icons/icon128.png" alt="Twitch Sidebar Icon" />
        <h1 className="login-title">Twitch Sidebar</h1>
        <p className="login-subtitle">{t("login.subtitle")}</p>
        {(error || initialError) && (
          <div className="login-error-box" role="alert">
            <span>⚠ {t("login.error")}</span>
          </div>
        )}
        <button id="login-btn" className="login-btn" onClick={handleLogin} disabled={loading}>
          <span className="login-btn-content">
            {loading && <span className="login-spinner" />}
            {t(loading ? "login.connecting" : "login.button")}
          </span>
        </button>
        <p className="login-privacy">{t("login.privacy")}</p>
      </main>

      <footer className="login-footer">
        <div className="login-lang-wrap">
          <select
            className="login-lang-select"
            value={lang}
            aria-label={t("settings.language")}
            onChange={(event) => changeLang(event.target.value)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          {/* Local pixel chevron: the extension does not bundle an icon font. */}
          <svg
            className="login-lang-chevron"
            viewBox="0 0 10 6"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="0" y="0" width="2" height="2" fill="currentColor" />
            <rect x="8" y="0" width="2" height="2" fill="currentColor" />
            <rect x="2" y="2" width="2" height="2" fill="currentColor" />
            <rect x="6" y="2" width="2" height="2" fill="currentColor" />
            <rect x="4" y="4" width="2" height="2" fill="currentColor" />
          </svg>
        </div>

        <p className="login-credit">
          {t("login.madeWith")}{" "}
          <a
            href="https://www.twitch.tv/thelouisxd"
            target="_blank"
            rel="noopener noreferrer"
            className="login-author-link"
          >
            ThelouisXD
          </a>
        </p>
      </footer>
    </div>
  )
}
