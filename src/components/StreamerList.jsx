import { useI18n } from "../i18n-context.js"
import TwitchCard from "./TwitchCard.jsx"
import EmptyState from "./EmptyState.jsx"

export default function StreamerList({
  query = "",
  filteredLive = [],
  filteredOffline = [],
  showOffline,
  notifiedIds = new Set(),
  handleToggleNotify,
  handleCardClick
}) {
  const { t } = useI18n()

  const favoriteChannels = []
  const regularLiveChannels = []

  for (const ch of filteredLive) {
    if (notifiedIds?.has(ch.user_id)) {
      favoriteChannels.push(ch)
    } else {
      regularLiveChannels.push(ch)
    }
  }

  const liveChannels = [...favoriteChannels, ...regularLiveChannels]
  const hasAnyLive = liveChannels.length > 0
  const hasVisibleOffline = Boolean(showOffline) && filteredOffline.length > 0
  const hasVisibleResults = hasAnyLive || hasVisibleOffline

  return (
    <div className="main-scroll">
      {!hasVisibleResults ? (
        <EmptyState
          icon={
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="4" />
              <path d="M6 12h4M8 10v4" />
              <circle cx="15.5" cy="11" r="0.8" fill="currentColor" />
              <circle cx="17.5" cy="13" r="0.8" fill="currentColor" />
            </svg>
          }
          message={query ? t("main.noResults", query) : t("main.noLive")}
        />
      ) : (
        hasAnyLive && (
          <div className="main-live-section">
            <div className="main-section-row">
              <span className="main-section-title">{t("main.live")}</span>
              <span className="main-badge" title={t("main.liveCount")}>
                {liveChannels.length}
              </span>
            </div>
            <div className="main-grid">
              {liveChannels.map((ch) => (
                <TwitchCard
                  key={ch.user_id}
                  channel={ch}
                  isLive
                  isFavorite={notifiedIds.has(ch.user_id)}
                  onToggleFavorite={handleToggleNotify}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        )
      )}

      {hasVisibleOffline && (
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
                isFavorite={notifiedIds.has(ch.user_id)}
                onToggleFavorite={handleToggleNotify}
                onClick={handleCardClick}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
