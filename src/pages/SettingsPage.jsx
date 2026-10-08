import { useState } from "react"
import { localSet, sendMessage } from "../platform.js"
import { POLL_INTERVAL_OPTIONS } from "../preferences.js"
import { usePreferences } from "../hooks/usePreferences.js"
import { useProfile } from "../hooks/useProfile.js"
import AccountProfile from "../components/AccountProfile.jsx"
import { useI18n } from "../i18n-context.js"
import "./SettingsPage.css"

export default function SettingsPage({ onLogout, onBack, showOffline, onNotifications }) {
  const { t, lang, changeLang } = useI18n()
  const profile = useProfile()
  const {
    pollInterval,
    favoritesFirst,
    rememberSession,
    loading: preferencesLoading,
    error: preferencesError
  } = usePreferences()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleToggleOffline() {
    const newValue = !showOffline
    try {
      await localSet({ showOffline: newValue })
      setError(null)
    } catch {
      setError("settings.saveError")
    }
  }

  async function handleIntervalChange(event) {
    const minutes = Number(event.target.value)
    setSaving(true)
    try {
      await sendMessage({ type: "SET_POLL_INTERVAL", minutes })
      setError(null)
    } catch {
      setError("settings.saveError")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleFavoritesFirst() {
    setSaving(true)
    try {
      await sendMessage({ type: "SET_FAVORITES_FIRST", enabled: !favoritesFirst })
      setError(null)
    } catch {
      setError("settings.saveError")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRememberSession() {
    setSaving(true)
    try {
      await sendMessage({ type: "SET_REMEMBER_SESSION", enabled: !rememberSession })
      setError(null)
    } catch {
      setError("settings.saveError")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-root" style={profile.colors}>
      <header className="settings-header">
        <button
          id="settings-back-btn"
          className="settings-back-btn"
          onClick={onBack}
          aria-label={t("settings.back")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="settings-header-title">{t("settings.title")}</span>
      </header>

      {(error || preferencesError) && (
        <div className="main-error-banner" role="alert">
          {t(error || "settings.saveError")}
        </div>
      )}

      <AccountProfile {...profile} />
      <div className="settings-section" style={{ marginTop: "16px" }}>
        <div className="settings-section-title">{t("settings.preferences")}</div>
        <div className="settings-info-list">
          <div className="settings-info-item">
            <span className="settings-info-label">{t("settings.language")}</span>
            <select
              className="settings-lang-select"
              aria-label={t("settings.language")}
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="settings-info-item">
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="settings-info-label">{t("settings.showOffline")}</span>
              <span className="settings-info-label">{t("settings.showOfflineTooltip")}</span>
            </div>
            <button
              id="settings-offline-toggle"
              className={`settings-toggle ${showOffline ? "settings-toggle--on" : ""}`}
              onClick={handleToggleOffline}
              role="switch"
              aria-checked={showOffline}
              aria-label={t("settings.showOffline")}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>

          <div className="settings-info-item settings-info-item--preference">
            <label className="settings-preference-copy" htmlFor="settings-poll-interval">
              <span className="settings-info-label">{t("settings.refreshInterval")}</span>
              <span className="settings-preference-hint">{t("settings.refreshIntervalHint")}</span>
            </label>
            <select
              id="settings-poll-interval"
              className="settings-lang-select"
              value={pollInterval}
              onChange={handleIntervalChange}
              disabled={saving || preferencesLoading}
            >
              {POLL_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("settings.minutes", minutes)}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-info-item settings-info-item--preference">
            <div className="settings-preference-copy">
              <span className="settings-info-label">{t("settings.favoritesFirst")}</span>
              <span className="settings-preference-hint">{t("settings.favoritesFirstHint")}</span>
            </div>
            <button
              id="settings-favorites-first-toggle"
              className={`settings-toggle ${favoritesFirst ? "settings-toggle--on" : ""}`}
              onClick={handleToggleFavoritesFirst}
              disabled={saving || preferencesLoading}
              role="switch"
              aria-checked={favoritesFirst}
              aria-label={t("settings.favoritesFirst")}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>

          <div className="settings-info-item settings-info-item--preference">
            <div className="settings-preference-copy">
              <span className="settings-info-label">{t("settings.rememberSession")}</span>
              <span className="settings-preference-hint">{t("settings.rememberSessionHint")}</span>
            </div>
            <button
              id="settings-remember-session-toggle"
              className={`settings-toggle ${rememberSession ? "settings-toggle--on" : ""}`}
              onClick={handleToggleRememberSession}
              disabled={saving || preferencesLoading}
              role="switch"
              aria-checked={rememberSession}
              aria-label={t("settings.rememberSession")}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>

          <button
            className="settings-info-item settings-info-item--clickable"
            onClick={onNotifications}
            id="settings-notifications-btn"
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--tw-text-secondary)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="settings-info-label">{t("settings.notifications")}</span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ color: "var(--tw-text-secondary)", flexShrink: 0 }}
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="settings-logout-section">
        <button id="settings-logout-btn" className="settings-logout-btn" onClick={onLogout}>
          {t("settings.logout")}
        </button>
      </div>
    </div>
  )
}
