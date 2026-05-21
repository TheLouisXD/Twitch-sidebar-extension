import { useState } from "react"
import { useI18n } from "../i18n"
import "./TwitchCard.css"

/**
 * TwitchCard — muestra un canal como tarjeta compacta.
 *
 * Props:
 *   channel  → objeto unificado (live o offline) con profile_image_url
 *   isLive   → boolean: true = en vivo (color), false = offline (grayscale)
 *   onClick  → función a llamar al hacer clic, recibe user_login
 */
export default function TwitchCard({ channel, isLive, onClick }) {
  const { t } = useI18n()
  const { user_name, user_login, game_name, profile_image_url, viewer_count } = channel
  const [dominantColor, setDominantColor] = useState(null)

  function formatViewers(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  function handleImageLoad(e) {
    try {
      const img = e.target
      const size = 8 // Sample at 8x8 for speed
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data

      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < data.length; i += 4) {
        const pr = data[i]
        const pg = data[i + 1]
        const pb = data[i + 2]
        const alpha = data[i + 3]
        if (alpha < 150) continue
        const brightness = (pr + pg + pb) / 3
        if (brightness > 30 && brightness < 240) {
          r += pr; g += pg; b += pb; count++
        }
      }

      if (count > 0) {
        setDominantColor([
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count)
        ])
      }
    } catch (err) {
      // Fail silently if canvas is tainted or image CORS is blocked
    }
  }

  return (
    <div
      className={`tc-card${isLive ? "" : " tc-card--offline"}`}
      onClick={() => onClick(user_login)}
      title={`${user_name}${game_name ? ` — ${game_name}` : ""}`}
    >
      {/* Profile picture */}
      <div className="tc-avatar-wrap">
        {profile_image_url ? (
          <img
            className={`tc-avatar${isLive ? "" : " tc-avatar--offline"}`}
            src={profile_image_url}
            alt={user_name}
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
          />
        ) : (
          <div className={`tc-avatar-fallback${isLive ? "" : " tc-avatar-fallback--offline"}`}>
            {user_name[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className="tc-info"
        style={dominantColor && isLive ? {
          borderTopColor: `rgba(${dominantColor.join(",")}, 0.5)`,
          background: `linear-gradient(to bottom, rgba(${dominantColor.join(",")}, 0.8) 0%, transparent 100%)`
        } : undefined}
      >
        <div className="tc-name">{user_name}</div>
        {isLive ? (
          <>
            <div className="tc-game">{game_name || "—"}</div>
            <div className="tc-viewers">👁 {formatViewers(viewer_count)}</div>
          </>
        ) : (
          <div className="tc-offline-label">{t("card.offline")}</div>
        )}
      </div>
    </div>
  )
}