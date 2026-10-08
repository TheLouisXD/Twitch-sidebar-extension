import React from "react"
import { useI18n } from "../i18n-context.js"
import "./TwitchCard.css"

/** @param {import("../types.js").TwitchCardProps} props */
const TwitchCard = React.memo(function TwitchCard({
  channel,
  isLive,
  onClick,
  isNotified = false,
  onToggleNotify
}) {
  const { t } = useI18n()
  const { user_name, user_login, game_name, profile_image_url, viewer_count, user_id } = channel

  function formatViewers(n) {
    if (!Number.isFinite(n)) return "0"
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  function handleBellClick(e) {
    e.stopPropagation()
    if (onToggleNotify) onToggleNotify(user_id)
  }

  const bellLabel = isNotified
    ? t("notifications.bell.deactivate")
    : t("notifications.bell.activate")

  return (
    <div
      className={`tc-card${isLive ? "" : " tc-card--offline"}`}
      title={`${user_name}${game_name ? ` — ${game_name}` : ""}`}
    >
      <a
        className="tc-channel-link"
        href={`https://www.twitch.tv/${user_login}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("card.openChannel", user_name)}
        onClick={(event) => {
          event.preventDefault()
          onClick(user_login)
        }}
      />
      <div className="tc-avatar-wrap">
        {profile_image_url ? (
          <img
            className={`tc-avatar${isLive ? "" : " tc-avatar--offline"}`}
            src={profile_image_url}
            alt={user_name}
          />
        ) : (
          <div className={`tc-avatar-fallback${isLive ? "" : " tc-avatar-fallback--offline"}`}>
            {user_name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      <div className={`tc-info${isLive && profile_image_url ? " tc-info--ambient" : ""}`}>
        {isLive && profile_image_url && (
          <div className="tc-ambient" aria-hidden="true">
            <img className="tc-ambient-image" src={profile_image_url} alt="" />
          </div>
        )}
        <div className="tc-name-row">
          <span className="tc-name">{user_name}</span>
          <button
            className={`tc-bell-btn${isNotified ? " tc-bell-btn--active" : ""}`}
            onClick={handleBellClick}
            aria-label={`${bellLabel}: ${user_name}`}
            aria-pressed={isNotified}
            title={bellLabel}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isNotified ? "var(--tw-warning)" : "none"}
              stroke={isNotified ? "var(--tw-warning)" : "var(--tw-text-secondary)"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

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
})

export default TwitchCard
