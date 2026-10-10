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

  const hasFavorites = favoriteChannels.length > 0
  const hasRegularLive = regularLiveChannels.length > 0
  const hasAnyLive = hasFavorites || hasRegularLive

  return (
    <div className="main-scroll">
      {!hasAnyLive ? (
        <EmptyState icon="🎮" message={query ? t("main.noResults", query) : t("main.noLive")} />
      ) : (
        <>
          {hasFavorites && (
            <div className="main-favorites-section">
              <div className="main-section-row main-section-row--favorites">
                <span className="main-section-title">{t("main.favorites")}</span>
                <span className="main-badge main-badge--favorites" title={t("main.favoritesCount")}>
                  {favoriteChannels.length}
                </span>
              </div>
              <div className="main-grid">
                {favoriteChannels.map((ch) => (
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
            </div>
          )}

          {hasRegularLive && (
            <div className="main-live-section">
              <div className="main-section-row">
                <span className="main-section-title">{t("main.live")}</span>
                <span className="main-badge" title={t("main.liveCount")}>
                  {regularLiveChannels.length}
                </span>
              </div>
              <div className="main-grid">
                {regularLiveChannels.map((ch) => (
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
            </div>
          )}
        </>
      )}

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
