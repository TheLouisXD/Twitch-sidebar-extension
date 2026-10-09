import { useState } from "react"
import { useI18n } from "../i18n-context.js"
import {
  CHANNELS_KEY,
  NOTIFICATIONS_KEY,
  EMPTY_NOTIFICATION_IDS,
  decodeChannelCache,
  decodeNotificationIds,
  removeFavoriteStreamer
} from "../cache.js"
import { useStoredValue } from "../hooks/useStoredValue.js"
import { formatAvatarUrl } from "../twitch.js"
import EmptyState from "../components/EmptyState.jsx"
import "./NotificationsPage.css"

export default function NotificationsPage({ onBack }) {
  const { t } = useI18n()
  const cache = useStoredValue(CHANNELS_KEY, null, decodeChannelCache)
  const watched = useStoredValue(NOTIFICATIONS_KEY, EMPTY_NOTIFICATION_IDS, decodeNotificationIds)
  const [error, setError] = useState(null)

  const loading = cache.loading || watched.loading
  const all = [...(cache.value?.data.live ?? []), ...(cache.value?.data.offline ?? [])]
  const byId = new Map(all.map((channel) => [channel.user_id, channel]))
  // Keep removable preferences for channels that were subsequently unfollowed.
  const streamers = watched.value.map(
    (id) =>
      byId.get(id) ?? {
        user_id: id,
        user_name: t("notifications.unknownChannel", id),
        isLive: false
      }
  )

  async function handleRemove(broadcasterId) {
    try {
      await removeFavoriteStreamer(broadcasterId)
      setError(null)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <div className="notif-root">
      <header className="notif-header">
        <button
          id="notif-back-btn"
          className="notif-back-btn"
          onClick={onBack}
          aria-label={t("settings.back")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="notif-header-title">{t("notifications.title")}</span>
        <svg
          className="notif-header-star notif-header-bell"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="#f5c518"
          stroke="#f5c518"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </header>

      {(error || cache.error || watched.error) && (
        <div className="main-error-banner" role="alert">
          {t("notifications.error")}
        </div>
      )}

      {loading ? (
        <div className="notif-loading">
          <div className="notif-spinner" />
        </div>
      ) : streamers.length === 0 ? (
        <EmptyState
          icon="⭐"
          message={t("notifications.empty")}
          hint={t("notifications.emptyHint")}
        />
      ) : (
        /* Streamer list */
        <div className="notif-list">
          {streamers.map((ch) => (
            <div key={ch.user_id} className="notif-item">
              <div className="notif-avatar-wrap">
                {ch.profile_image_url ? (
                  <img
                    className="notif-avatar"
                    src={formatAvatarUrl(ch.profile_image_url)}
                    alt={ch.user_name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="notif-avatar-fallback">
                    {ch.user_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                {ch.isLive && <span className="notif-live-dot" aria-label={t("main.live")} />}
              </div>
              <div className="notif-item-info">
                <span className="notif-item-name">{ch.user_name}</span>
                {ch.isLive && ch.game_name && (
                  <span className="notif-item-game">{ch.game_name}</span>
                )}
              </div>
              <button
                className="notif-remove-btn"
                onClick={() => handleRemove(ch.user_id)}
                aria-label={t("notifications.removeLabel", ch.user_name)}
                title={t("notifications.remove")}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="#f5c518"
                  stroke="#f5c518"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{t("notifications.remove")}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
