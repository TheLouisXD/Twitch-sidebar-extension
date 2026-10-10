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
      <div className="login-box">
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
        <p className="login-privacy">
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
        <select
          className="settings-lang-select"
          value={lang}
          aria-label={t("settings.language")}
          onChange={(event) => changeLang(event.target.value)}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  )
}
