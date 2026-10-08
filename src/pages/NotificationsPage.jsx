import { useState } from "react"
import { useI18n } from "../i18n-context.js"
import {
  CHANNELS_KEY,
  NOTIFICATIONS_KEY,
  EMPTY_NOTIFICATION_IDS,
  decodeChannelCache,
  decodeNotificationIds,
  removeNotificationStreamer
} from "../cache.js"
import { useStoredValue } from "../hooks/useStoredValue.js"
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
      await removeNotificationStreamer(broadcasterId)
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
          className="notif-header-bell"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--tw-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
          icon="🔔"
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
                  <img className="notif-avatar" src={ch.profile_image_url} alt={ch.user_name} />
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
                  fill="currentColor"
                  stroke="var(--tw-warning)"
                  strokeWidth="0"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="var(--tw-warning)" />
                  <path
                    d="M13.73 21a2 2 0 0 1-3.46 0"
                    fill="none"
                    stroke="var(--tw-warning)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
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
