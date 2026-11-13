import { useState, useRef } from "react"
import { localSet, sendMessage } from "../platform.js"
import { POLL_INTERVAL_OPTIONS } from "../preferences.js"
import { usePreferences } from "../hooks/usePreferences.js"
import { useProfile } from "../hooks/useProfile.js"
import AccountProfile from "../components/AccountProfile.jsx"
import { useI18n } from "../i18n-context.js"
import {
  MAX_BACKUP_BYTES,
  createBackupPayload,
  exportBackupFile,
  validateBackupData,
  applyBackupData
} from "../backup.js"
import "./SettingsPage.css"

export default function SettingsPage({ onLogout, onBack, showOffline, onNotifications, onThemes }) {
  const { t, lang, changeLang } = useI18n()
  const profile = useProfile()
  const {
    pollInterval,
    rememberSession,
    theme,
    loading: preferencesLoading,
    error: preferencesError
  } = usePreferences()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [backupFeedback, setBackupFeedback] = useState(null)
  const fileInputRef = useRef(null)

  async function handleExport() {
    setSaving(true)
    setBackupFeedback(null)
    try {
      const payload = await createBackupPayload()
      const result = await exportBackupFile(payload)
      if (result.success) {
        setBackupFeedback({ type: "success", key: "settings.backupExportSuccess" })
      } else if (result.error) {
        setBackupFeedback({ type: "error", key: result.error })
      }
    } catch {
      setBackupFeedback({ type: "error", key: "settings.backupError" })
    } finally {
      setSaving(false)
    }
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    if (file.size > MAX_BACKUP_BYTES) {
      setBackupFeedback({ type: "error", key: "settings.backupInvalidFile" })
      return
    }
    setSaving(true)
    setBackupFeedback(null)
    try {
      const text = await file.text()
      const validation = validateBackupData(text)
      if (!validation.valid) {
        setBackupFeedback({ type: "error", key: validation.error })
        return
      }
      await applyBackupData(validation.data)
      setBackupFeedback({ type: "success", key: "settings.backupSuccess" })
    } catch {
      setBackupFeedback({ type: "error", key: "settings.backupError" })
    } finally {
      setSaving(false)
    }
  }

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
      <div className="settings-section settings-section--spaced">
        <div className="settings-section-title">{t("settings.preferences")}</div>
        <div className="settings-info-list">
          <div className="settings-info-item">
            <span className="settings-info-label">{t("settings.language")}</span>
            <select
              className="settings-lang-select"
              aria-label={t("settings.language")}
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
              disabled={saving}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            className="settings-info-item settings-info-item--clickable"
            onClick={onThemes}
            id="settings-themes-btn"
          >
            <span className="settings-item-row">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 0 20v-20z" fill="var(--tw-text-secondary)" />
              </svg>
              <span className="settings-info-label">{t("settings.theme")}</span>
            </span>
            <div className="settings-item-value-row">
              <span className="settings-preference-hint">
                {theme === "gx" ? t("settings.themeGx") : t("settings.themeDefault")}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="settings-chevron"
              >
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
              </svg>
            </div>
          </button>
          <div className="settings-info-item">
            <div className="settings-stack">
              <span className="settings-info-label">{t("settings.showOffline")}</span>
              <span className="settings-info-label">{t("settings.showOfflineTooltip")}</span>
            </div>
            <button
              id="settings-offline-toggle"
              className={`settings-toggle ${showOffline ? "settings-toggle--on" : ""}`}
              onClick={handleToggleOffline}
              disabled={saving}
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
            <span className="settings-item-row">
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
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="settings-info-label">{t("settings.notifications")}</span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="settings-chevron"
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="settings-section settings-section--spaced">
        <div className="settings-section-title">{t("settings.backup")}</div>
        <div className="settings-backup-group">
          <input
            id="settings-import-file-input"
            type="file"
            accept=".json,application/json"
            className="settings-file-input"
            ref={fileInputRef}
            onChange={handleFileImport}
          />
          <button
            id="settings-import-btn"
            type="button"
            className="settings-backup-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            {t("settings.import")}
          </button>
          <button
            id="settings-export-btn"
            type="button"
            className="settings-backup-btn"
            onClick={handleExport}
            disabled={saving}
          >
            {t("settings.export")}
          </button>
        </div>
        {backupFeedback && (
          <div
            className={`settings-backup-feedback${
              backupFeedback.type === "error" ? " settings-backup-feedback--error" : ""
            }`}
            role={backupFeedback.type === "error" ? "alert" : "status"}
          >
            {t(backupFeedback.key)}
          </div>
        )}
      </div>
      <div className="settings-logout-section">
        <button id="settings-logout-btn" className="settings-logout-btn" onClick={onLogout}>
          {t("settings.logout")}
        </button>
      </div>
    </div>
  )
}
