import { useEffect, useState } from "react"
import { useI18n } from "../i18n-context.js"
import { getNotificationStreamers, removeNotificationStreamer, getCachedChannels } from "../cache"
import EmptyState from "../components/EmptyState"
import "./NotificationsPage.css"

/**
 * NotificationsPage — lista los streamers con la campanita activada.
 *
 * Props:
 *   onBack → función para volver a SettingsPage
 */
export default function NotificationsPage({ onBack }) {
  const { t } = useI18n()
  const [streamers, setStreamers]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [ids, cached] = await Promise.all([getNotificationStreamers(), getCachedChannels()])

        if (active && cached?.data) {
          const all = [...(cached.data.live ?? []), ...(cached.data.offline ?? [])]
          setStreamers(all.filter((ch) => ids.has(ch.user_id)))
        }
      } catch (failure) {
        if (active) setError(failure.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function handleRemove(broadcasterId) {
    try {
      await removeNotificationStreamer(broadcasterId)
      setStreamers((prev) => prev.filter((s) => s.user_id !== broadcasterId))
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <div className="notif-root">
      {/* Header */}
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

        {/* Bell icon decoration */}
        <svg className="notif-header-bell" width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="#9147ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </header>

      {error && <div className="main-error-banner" role="alert">{t("notifications.error")}</div>}

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
              {/* Avatar */}
              <div className="notif-avatar-wrap">
                {ch.profile_image_url ? (
                  <img
                    className="notif-avatar"
                    src={ch.profile_image_url}
                    alt={ch.user_name}
                  />
                ) : (
                  <div className="notif-avatar-fallback">
                    {ch.user_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                {/* Live badge */}
                {ch.isLive && <span className="notif-live-dot" aria-label="Live" />}
              </div>

              {/* Info */}
              <div className="notif-item-info">
                <span className="notif-item-name">{ch.user_name}</span>
                {ch.isLive && ch.game_name && (
                  <span className="notif-item-game">{ch.game_name}</span>
                )}
              </div>

              {/* Remove button */}
              <button
                className="notif-remove-btn"
                onClick={() => handleRemove(ch.user_id)}
                aria-label={t("notifications.remove")}
                title={t("notifications.remove")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
                  stroke="#f5c518" strokeWidth="0">
                  {/* Filled bell with X slash — just a filled bell that indicates active */}
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="#f5c518"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="#f5c518"
                    strokeWidth="2" strokeLinecap="round"/>
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
