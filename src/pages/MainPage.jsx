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
import "./MainPage.css"

const SPINNER_BLADES = Array.from({ length: 12 }, (_, index) => index)

function IosSpinner() {
  return (
    <div className="spinner" aria-hidden="true">
      {SPINNER_BLADES.map((blade) => (
        <div key={blade} className="spinner-blade" />
      ))}
    </div>
  )
}

export default function MainPage({ onSettings, showOffline }) {
  const { t } = useI18n()
  const [channels, setChannels] = useState({ live: [], offline: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [notifiedIds, setNotifiedIds] = useState(new Set())
  const [attempt, setAttempt] = useState(0)
  const updatedAtRef = useRef(0)

  useEffect(() => {
    let active = true
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
    }
    extension.storage.onChanged.addListener(onStorageChanged)
    async function load() {
      try {
        const pollPromise = sendMessage({ type: attempt ? "POLL_NOW" : "LOAD_CHANNELS" })
        pollPromise.catch(() => {})
        const [cached, ids] = await Promise.all([getCachedChannels(), getNotificationStreamers()])
        if (!active) return
        if (!notificationsChanged) setNotifiedIds(ids)
        setError(null)
        if (cached) {
          applySnapshot(cached.data, cached.ts)
        }
        setRefreshing(true)
        const result = await pollPromise
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
  const { filteredLive, filteredOffline } = useMemo(
    () => search(channels.live, channels.offline, query),
    [channels.live, channels.offline, query]
  )
  const showReloadDrawer = refreshing && !loading

  return (
    <div className="main-root">
      <Header onSettings={onSettings} />
      <SearchBar query={query} setQuery={setQuery} />
      <div
        className={`main-reload-drawer${showReloadDrawer ? " main-reload-drawer--open" : ""}`}
        role="status"
        aria-live="polite"
        aria-hidden={!showReloadDrawer}
      >
        <div className="main-reload-inner">
          <div className="main-reload-content">
            <IosSpinner />
            <span className="main-reload-text">{t("main.reloading")}</span>
          </div>
        </div>
      </div>
      {error && (
        <div className="main-error-banner" role="alert">
          ⚠ {t("main.loadError")}{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>{t("common.retry")}</button>
        </div>
      )}
      {loading ? (
        <div className="main-center" role="status" aria-live="polite">
          <IosSpinner />
          <span className="main-loading-text">{t("main.reloading")}</span>
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
