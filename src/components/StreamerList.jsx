import { useI18n } from "../i18n-context.js"
import TwitchCard from "./twitchcard"
import EmptyState from "./EmptyState"

export default function StreamerList({
  query,
  filteredLive,
  filteredOffline,
  liveCount,
  showOffline,
  notifiedIds,
  handleToggleNotify,
  handleCardClick
}) {
  const { t } = useI18n()

  return (
    <div className="main-scroll">
      {/* ── En vivo ── */}
      <div className="main-section-row">
        <span className="main-section-title">{t("main.live")}</span>
        <span className="main-badge" title={t("main.liveCount")}>{liveCount}</span>
      </div>

      {filteredLive.length === 0 ? (
        <EmptyState
          icon="🎮"
          message={query ? t("main.noResults", query) : t("main.noLive")}
        />
      ) : (
        <div className="main-grid">
          {filteredLive.map((ch) => (
            <TwitchCard
              key={ch.user_id}
              channel={ch}
              isLive
              isNotified={notifiedIds.has(ch.user_id)}
              onToggleNotify={handleToggleNotify}
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {/* ── Offline ── */}
      {showOffline && filteredOffline.length > 0 && (
        <>
          <div className="main-section-row main-section-row--offline">
            <span className="main-section-title">{t("main.offline")}</span>
            <span className="main-badge main-badge--offline">{filteredOffline.length}</span>
          </div>
          <div className="main-grid">
            {filteredOffline.map((ch) => (
              <TwitchCard
                key={ch.user_id}
                channel={ch}
                isLive={false}
                isNotified={notifiedIds.has(ch.user_id)}
                onToggleNotify={handleToggleNotify}
                onClick={handleCardClick}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
