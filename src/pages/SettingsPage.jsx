import { useEffect, useState } from "react"
import { extension, localSet, sendMessage } from "../platform.js"
import { getPreferences, DEFAULT_POLL_INTERVAL, POLL_INTERVAL_KEY, FAVORITES_FIRST_KEY,
  POLL_INTERVAL_OPTIONS, normalizePollInterval } from "../preferences.js"
import { useI18n } from "../i18n-context.js"
import "./SettingsPage.css"

/**
 * Extract the dominant color from an image URL using a small canvas.
 * Returns [r, g, b] or null on failure.
 */
function extractDominantColor(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const size = 16 // Sample at 16x16 for speed
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data

        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          // Skip very dark pixels (backgrounds) and very light pixels
          const pr = data[i], pg = data[i + 1], pb = data[i + 2]
          const brightness = (pr + pg + pb) / 3
          if (brightness > 30 && brightness < 240) {
            r += pr; g += pg; b += pb; count++
          }
        }

        if (count === 0) { resolve(null); return }
        resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)])
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

export default function SettingsPage({ onLogout, onBack, showOffline, onShowOfflineChange, onNotifications }) {
  const { t, lang, changeLang } = useI18n()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bgGradient, setBgGradient] = useState(null)
  const [error, setError] = useState(null)
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL)
  const [favoritesFirst, setFavoritesFirst] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    let intervalChanged = false
    let favoritesChanged = false
    const onStorageChanged = (changes, area) => {
      if (area !== "local") return
      if (changes[POLL_INTERVAL_KEY]) {
        intervalChanged = true
        setPollInterval(normalizePollInterval(changes[POLL_INTERVAL_KEY].newValue))
      }
      if (changes[FAVORITES_FIRST_KEY]) {
        favoritesChanged = true
        setFavoritesFirst(changes[FAVORITES_FIRST_KEY].newValue === true)
      }
    }
    extension.storage.onChanged.addListener(onStorageChanged)
    getPreferences().then((preferences) => {
      if (!active) return
      if (!intervalChanged) setPollInterval(preferences.pollIntervalMinutes)
      if (!favoritesChanged) setFavoritesFirst(preferences.favoritesFirst)
    }).catch(() => { if (active) setError("settings.saveError") })
    async function fetchUserProfile() {
      try {
        const { profile } = await sendMessage({ type: "GET_PROFILE" })
        if (active && profile) {
          setUser(profile)
          // Extract dominant color for the background gradient
          if (profile.profile_image_url) {
            const color = await extractDominantColor(profile.profile_image_url)
            if (active && color) {
              const [r, g, b] = color
              // Top: the dominant color at ~40% opacity, Bottom: much darker
              const top = `rgba(${r}, ${g}, ${b}, 0.45)`
              const dark = `rgba(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)}, 1)`
              setBgGradient(`linear-gradient(to bottom, ${top} 0%, ${dark} 50%, #0e0e10 100%)`)
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch user profile:", e)
        if (active) setError("settings.error")
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchUserProfile()
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [])

  // Format account creation date
  function formatDate(isoDate) {
    if (!isoDate) return "—"
    return new Date(isoDate).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  async function handleToggleOffline() {
    const newValue = !showOffline
    try {
      await localSet({ showOffline: newValue })
      onShowOfflineChange(newValue)
    } catch {
      setError("settings.saveError")
    }
  }

  async function handleIntervalChange(event) {
    const minutes = Number(event.target.value)
    setSaving(true)
    try {
      const preferences = await sendMessage({ type: "SET_POLL_INTERVAL", minutes })
      setPollInterval(preferences.pollIntervalMinutes)
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
      const preferences = await sendMessage({ type: "SET_FAVORITES_FIRST", enabled: !favoritesFirst })
      setFavoritesFirst(preferences.favoritesFirst)
      setError(null)
    } catch {
      setError("settings.saveError")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-root" style={bgGradient ? { background: bgGradient } : undefined}>
      {/* Header with back button */}
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

      {error && <div className="main-error-banner" role="alert">{t(error)}</div>}

      {loading ? (
        <div className="settings-loading">
          <div className="settings-spinner" />
        </div>
      ) : (
        <>
          {/* Profile card */}
          <div className="settings-profile">
            <div className="settings-avatar-wrap">
              {user?.profile_image_url ? (
                <img
                  className="settings-avatar"
                  src={user.profile_image_url}
                  alt={user.display_name}
                />
              ) : (
                <div className="settings-avatar-placeholder" />
              )}
            </div>
            <span className="settings-username">{user?.display_name ?? "—"}</span>
            <span className="settings-login">@{user?.login ?? "—"}</span>
          </div>

          {/* Account info */}
          <div className="settings-section">
            <div className="settings-section-title">{t("settings.account")}</div>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">{t("settings.followers")}</span>
                <span className="settings-info-value">{user?.followers ?? "—"}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">{t("settings.type")}</span>
                <span className="settings-info-value">
                  {user?.broadcaster_type === "partner"
                    ? t("settings.partner")
                    : user?.broadcaster_type === "affiliate"
                    ? t("settings.affiliate")
                    : t("settings.standard")}
                </span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">{t("settings.created")}</span>
                <span className="settings-info-value">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Preferences */}
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
                <select id="settings-poll-interval" className="settings-lang-select"
                  value={pollInterval} onChange={handleIntervalChange} disabled={saving}>
                  {POLL_INTERVAL_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>{t("settings.minutes", minutes)}</option>
                  ))}
                </select>
              </div>
              <div className="settings-info-item settings-info-item--preference">
                <div className="settings-preference-copy">
                  <span className="settings-info-label">{t("settings.favoritesFirst")}</span>
                  <span className="settings-preference-hint">{t("settings.favoritesFirstHint")}</span>
                </div>
                <button id="settings-favorites-first-toggle"
                  className={`settings-toggle ${favoritesFirst ? "settings-toggle--on" : ""}`}
                  onClick={handleToggleFavoritesFirst} disabled={saving}
                  role="switch" aria-checked={favoritesFirst} aria-label={t("settings.favoritesFirst")}>
                  <span className="settings-toggle-knob" />
                </button>
              </div>

              {/* Live Notifications nav item */}
              <div
                className="settings-info-item settings-info-item--clickable"
                onClick={onNotifications}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onNotifications()}
                id="settings-notifications-btn"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#adadb8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span className="settings-info-label">{t("settings.notifications")}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                  style={{ color: "#adadb8", flexShrink: 0 }}>
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </div>
            </div>
          </div>


          {/* Logout */}
          <div className="settings-logout-section">
            <button
              id="settings-logout-btn"
              className="settings-logout-btn"
              onClick={onLogout}
            >
              {t("settings.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
