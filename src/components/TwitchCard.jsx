import React from "react"
import { useI18n } from "../i18n-context.js"
import { formatAvatarUrl } from "../twitch.js"
import "./TwitchCard.css"

/** @param {import("../types.js").TwitchCardProps} props */
const TwitchCard = React.memo(function TwitchCard({
  channel,
  isLive,
  onClick,
  isFavorite = false,
  onToggleFavorite
}) {
  const { t } = useI18n()
  const { user_name, user_login, game_name, profile_image_url, viewer_count, user_id } = channel
  const avatarUrl = formatAvatarUrl(profile_image_url)

  function formatViewers(n) {
    if (!Number.isFinite(n)) return "0"
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  function handleStarClick(e) {
    e.stopPropagation()
    if (onToggleFavorite) onToggleFavorite(user_id)
  }

  const isValidLogin = typeof user_login === "string" && /^[a-zA-Z0-9_]+$/.test(user_login)
  const channelHref = isValidLogin ? `https://www.twitch.tv/${user_login}` : "#"

  const favLabel = isFavorite
    ? t("notifications.bell.deactivate")
    : t("notifications.bell.activate")

  return (
    <div
      className={`tc-card${isLive ? "" : " tc-card--offline"}`}
      title={`${user_name}${game_name ? `: ${game_name}` : ""}`}
    >
      <a
        className="tc-channel-link"
        href={channelHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("card.openChannel", user_name)}
        onClick={(event) => {
          event.preventDefault()
          onClick(user_login)
        }}
      />
      <div className="tc-media">
        <button
          className={`tc-star-btn${isFavorite ? " tc-star-btn--active" : ""}`}
          onClick={handleStarClick}
          aria-label={`${favLabel}: ${user_name}`}
          aria-pressed={isFavorite}
          title={favLabel}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill={isFavorite ? "#f5c518" : "none"}
            stroke={isFavorite ? "#f5c518" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <div className="tc-avatar-wrap aero-glass-frame">
          {avatarUrl ? (
            <img
              className={`tc-avatar${isLive ? "" : " tc-avatar--offline"}`}
              src={avatarUrl}
              alt={user_name}
              width="150"
              height="150"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={`tc-avatar-fallback${isLive ? "" : " tc-avatar-fallback--offline"}`}>
              {user_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      </div>
      <div className={`tc-info${isLive && avatarUrl ? " tc-info--ambient" : ""}`}>
        {isLive && avatarUrl && (
          <div className="tc-ambient" aria-hidden="true">
            <img
              className="tc-ambient-image"
              src={avatarUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <div className="tc-name">{user_name}</div>

        {isLive ? (
          <>
            <div className="tc-game">{game_name || "-"}</div>
            <div className="tc-viewers">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{formatViewers(viewer_count)}</span>
            </div>
          </>
        ) : (
          <div className="tc-offline-label">{t("card.offline")}</div>
        )}
      </div>
    </div>
  )
})

export default TwitchCard
