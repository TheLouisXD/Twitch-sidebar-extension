import { useEffect, useState } from "react"
import { CLIENT_ID } from "../auth"
import { useI18n } from "../i18n"
import "./SettingsPage.css"

const API = "https://api.twitch.tv/helix"

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

export default function SettingsPage({ token, onLogout, onBack }) {
  const { t, lang, changeLang } = useI18n()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bgGradient, setBgGradient] = useState(null)

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const res = await fetch(`${API}/users`, {
          headers: {
            "Client-ID": CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error("Failed to fetch user")
        const data = await res.json()
        if (data.data?.[0]) {
          const profile = data.data[0]
          setUser(profile)

          // Fetch follower count
          try {
            const followersRes = await fetch(
              `${API}/channels/followers?broadcaster_id=${profile.id}&first=1`,
              {
                headers: {
                  "Client-ID": CLIENT_ID,
                  Authorization: `Bearer ${token}`,
                },
              }
            )
            if (followersRes.ok) {
              const followersData = await followersRes.json()
              setUser((prev) => ({ ...prev, followers: followersData.total ?? 0 }))
            }
          } catch (_) {
            // Non-critical — just leave followers as undefined
          }

          // Extract dominant color for the background gradient
          if (profile.profile_image_url) {
            const color = await extractDominantColor(profile.profile_image_url)
            if (color) {
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
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [token])

  // Format account creation date
  function formatDate(isoDate) {
    if (!isoDate) return "—"
    return new Date(isoDate).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="settings-root" style={bgGradient ? { background: bgGradient } : undefined}>
      {/* Header with back button */}
      <header className="settings-header">
        <button
          id="settings-back-btn"
          className="settings-back-btn"
          onClick={onBack}
          aria-label="Volver"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="settings-header-title">{t("settings.title")}</span>
      </header>

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

          {/* Language selector */}
          <div className="settings-section" style={{ marginTop: "16px" }}>
            <div className="settings-section-title">{t("settings.preferences")}</div>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">{t("settings.language")}</span>
                <select
                  className="settings-lang-select"
                  value={lang}
                  onChange={(e) => changeLang(e.target.value)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
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
