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
  const { user_name, user_login, game_name, profile_image_url, viewer_count } = channel

  function formatViewers(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
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
          />
        ) : (
          <div className={`tc-avatar-fallback${isLive ? "" : " tc-avatar-fallback--offline"}`}>
            {user_name[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="tc-info">
        <div className="tc-name">{user_name}</div>
        {isLive ? (
          <>
            <div className="tc-game">{game_name || "—"}</div>
            <div className="tc-viewers">👁 {formatViewers(viewer_count)}</div>
          </>
        ) : (
          <div className="tc-offline-label">Offline</div>
        )}
      </div>
    </div>
  )
}