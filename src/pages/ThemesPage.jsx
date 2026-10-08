import { useState } from "react"
import { useI18n } from "../i18n-context.js"
import { localSet } from "../platform.js"
import { THEME_KEY, DEFAULT_THEME, normalizeTheme, THEMES } from "../preferences.js"
import { useStoredValue } from "../hooks/useStoredValue.js"
import "./ThemesPage.css"

export default function ThemesPage({ onBack }) {
  const { t } = useI18n()
  const { value: currentTheme } = useStoredValue(THEME_KEY, DEFAULT_THEME, normalizeTheme)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSelectTheme(themeId) {
    if (themeId === currentTheme || saving) return
    setSaving(true)
    try {
      await localSet({ [THEME_KEY]: themeId })
      setError(null)
    } catch {
      setError("settings.saveError")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="themes-root">
      <header className="themes-header">
        <button
          id="themes-back-btn"
          className="themes-back-btn"
          onClick={onBack}
          aria-label={t("settings.back")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="themes-header-title">{t("themes.title")}</span>
        <svg
          className="themes-header-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20v-20z" fill="currentColor" />
        </svg>
      </header>

      {error && (
        <div className="main-error-banner" role="alert">
          {t(error)}
        </div>
      )}

      <div className="themes-grid" role="radiogroup" aria-label={t("themes.title")}>
        {THEMES.map((item) => {
          const isActive = item.id === currentTheme
          return (
            <button
              key={item.id}
              type="button"
              className={`theme-card ${isActive ? "theme-card--active" : ""}`}
              onClick={() => handleSelectTheme(item.id)}
              role="radio"
              aria-checked={isActive}
              aria-label={`${t(item.nameKey)}${isActive ? ` (${t("themes.active")})` : ""}`}
            >
              <div className="theme-card-preview-wrap">
                {/* Espacio para la foto del tema: cuando tengas la imagen lista,
                    asigna su ruta en THEMES (preferences.js) en previewUrl */}
                {item.previewUrl ? (
                  <img
                    className="theme-card-img"
                    src={item.previewUrl}
                    alt={t(item.nameKey)}
                    loading="lazy"
                  />
                ) : (
                  <div className={`theme-card-placeholder theme-card-placeholder--${item.id}`}>
                    <svg
                      className="theme-card-placeholder-icon"
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="theme-card-placeholder-label">Preview</span>
                  </div>
                )}
                {isActive && (
                  <span className="theme-card-badge" aria-label={t("themes.active")}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="theme-card-info">
                <span className="theme-card-name">{t(item.nameKey)}</span>
                <span className="theme-card-status">
                  {isActive ? t("themes.active") : t("themes.select")}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
