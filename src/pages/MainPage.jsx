import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useI18n } from "../i18n-context.js"
import Header from "../components/Header.jsx"
import StreamerList from "../components/StreamerList.jsx"
import { SearchBar } from "../components/SearchBar.jsx"
import { search } from "../search.js"
import {
  CHANNELS_KEY,
  NOTIFICATIONS_KEY,
  getCachedChannels,
  getNotificationStreamers,
  toggleNotificationStreamer
} from "../cache.js"
import { extension, sendMessage, openChannel } from "../platform.js"
import { getPreferences, FAVORITES_FIRST_KEY, orderLiveChannels } from "../preferences.js"
import "./MainPage.css"

export default function MainPage({ onSettings, showOffline }) {
  const { t } = useI18n()
  const [channels, setChannels] = useState({ live: [], offline: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [notifiedIds, setNotifiedIds] = useState(new Set())
  const [attempt, setAttempt] = useState(0)
  const [favoritesFirst, setFavoritesFirst] = useState(false)
  const updatedAtRef = useRef(0)

  useEffect(() => {
    let active = true
    let preferencesChanged = false
    let notificationsChanged = false
    function applySnapshot(data, timestamp) {
      const updatedAt = Number.isFinite(timestamp) ? timestamp : 0
      if (!active || !data || updatedAt < updatedAtRef.current) return
      updatedAtRef.current = updatedAt
      setChannels(data)
      setLoading(false)
      setError(null)
    }
    const onStorageChanged = (changes, area) => {
      if (area !== "local") return
      const snapshot = changes[CHANNELS_KEY]?.newValue
      if (snapshot) applySnapshot(snapshot.data, snapshot.ts)
      if (changes[NOTIFICATIONS_KEY]) {
        notificationsChanged = true
        setNotifiedIds(new Set(changes[NOTIFICATIONS_KEY].newValue ?? []))
      }
      if (changes[FAVORITES_FIRST_KEY]) {
        preferencesChanged = true
        setFavoritesFirst(changes[FAVORITES_FIRST_KEY].newValue === true)
      }
    }
    extension.storage.onChanged.addListener(onStorageChanged)
    async function load() {
      try {
        const [cached, ids, preferences] = await Promise.all([
          getCachedChannels(),
          getNotificationStreamers(),
          getPreferences()
        ])
        if (!active) return
        if (!notificationsChanged) setNotifiedIds(ids)
        if (!preferencesChanged) setFavoritesFirst(preferences.favoritesFirst)
        setError(null)
        if (cached) {
          applySnapshot(cached.data, cached.ts)
        }
        setRefreshing(true)
        const result = await sendMessage({ type: attempt ? "POLL_NOW" : "LOAD_CHANNELS" })
        applySnapshot(result.channels, result.updatedAt)
      } catch (failure) {
        if (active) setError(failure.message)
      } finally {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }
    load()
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [attempt])

  const handleToggleNotify = useCallback(async (id) => {
    try {
      await toggleNotificationStreamer(id)
    } catch (failure) {
      setError(failure.message)
    }
  }, [])
  const handleCardClick = useCallback((login) => {
    openChannel(login).catch((failure) => setError(failure.message))
  }, [])
  const orderedLive = useMemo(
    () => orderLiveChannels(channels.live, notifiedIds, favoritesFirst),
    [channels.live, notifiedIds, favoritesFirst]
  )
  const { filteredLive, filteredOffline } = useMemo(
    () => search(orderedLive, channels.offline, query),
    [orderedLive, channels.offline, query]
  )

  return (
    <div className="main-root">
      <Header onSettings={onSettings} />
      <SearchBar query={query} setQuery={setQuery} />
      {refreshing && <div className="main-refresh-bar" />}
      {error && (
        <div className="main-error-banner" role="alert">
          ⚠ {t("main.loadError")}{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>{t("common.retry")}</button>
        </div>
      )}
      {loading ? (
        <div className="main-center">
          <div className="main-spinner" />
          <span className="main-loading-text">{t("main.loading")}</span>
        </div>
      ) : (
        <StreamerList
          query={query}
          filteredLive={filteredLive}
          filteredOffline={filteredOffline}
          showOffline={showOffline}
          notifiedIds={notifiedIds}
          handleToggleNotify={handleToggleNotify}
          handleCardClick={handleCardClick}
        />
      )}
    </div>
  )
}
