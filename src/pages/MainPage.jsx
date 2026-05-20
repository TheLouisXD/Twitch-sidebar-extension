import { useEffect, useState, useRef } from "react"
import { CLIENT_ID } from "../auth"
import { useI18n } from "../i18n"
import TwitchCard from "../components/twitchcard"
import { SearchBar, search } from "../components/search"
import {
  getCachedChannels, setCachedChannels,
  getCachedProfiles, setCachedProfiles,
} from "../cache"
import "./MainPage.css"

const API = "https://api.twitch.tv/helix"
const hdrs = (token) => ({
  "Client-ID": CLIENT_ID,
  Authorization: `Bearer ${token}`,
})

/** Divide un array en grupos de `size` elementos */
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Fetch helpers ────────────────────────────────────────────

/** Custom error for expired/revoked tokens (401) */
class TokenExpiredError extends Error {
  constructor() { super("Token expired") }
}

/** Get the authenticated user's ID */
async function fetchUserId(token) {
  const res = await fetch(`${API}/users`, { headers: hdrs(token) })
  if (res.status === 401) throw new TokenExpiredError()
  if (!res.ok) throw new Error("API error")
  return (await res.json()).data[0].id
}

/** Paginate through ALL followed channels */
async function fetchFollowedIds(token, userId) {
  const allFollows = []
  let cursor = null

  do {
    const params = new URLSearchParams({ user_id: userId, first: "100" })
    if (cursor) params.set("after", cursor)
    const res  = await fetch(`${API}/channels/followed?${params}`, { headers: hdrs(token) })
    const json = await res.json()
    allFollows.push(...(json.data ?? []))
    cursor = json.pagination?.cursor ?? null
  } while (cursor)

  return allFollows
}

/** Fetch streams status in batches of 100 */
async function fetchStreams(token, broadcasterIds) {
  const idChunks = chunk(broadcasterIds, 100)
  const pages = await Promise.all(
    idChunks.map((ids) => {
      const params = new URLSearchParams()
      ids.forEach((id) => params.append("user_id", id))
      return fetch(`${API}/streams?${params}`, { headers: hdrs(token) })
        .then((r) => r.json()).then((j) => j.data ?? [])
    })
  )
  return pages.flat()
}

/** Fetch user profiles in batches of 100 */
async function fetchProfiles(token, userIds) {
  const idChunks = chunk(userIds, 100)
  const pages = await Promise.all(
    idChunks.map((ids) => {
      const params = new URLSearchParams()
      ids.forEach((id) => params.append("id", id))
      return fetch(`${API}/users?${params}`, { headers: hdrs(token) })
        .then((r) => r.json()).then((j) => j.data ?? [])
    })
  )
  return pages.flat()
}

/**
 * Build the final { live, offline } channel lists.
 *
 * Uses the 24h profile cache: only fetches /users for IDs not already cached.
 * Always fetches fresh /streams data.
 */
async function fetchAllFollowed(token) {
  const userId = await fetchUserId(token)
  const allFollows = await fetchFollowedIds(token, userId)

  if (!allFollows.length) return { live: [], offline: [] }

  const broadcasterIds = allFollows.map((f) => f.broadcaster_id)

  // ── Profile cache (24h) ──
  const { map: cachedProfiles, fresh: profilesFresh } = await getCachedProfiles()

  // Only fetch profiles we don't have cached (or all if cache expired)
  let profileMap = { ...cachedProfiles }
  const missingIds = profilesFresh
    ? broadcasterIds.filter((id) => !(id in cachedProfiles))
    : broadcasterIds

  if (missingIds.length > 0) {
    const freshProfiles = await fetchProfiles(token, missingIds)
    for (const u of freshProfiles) {
      profileMap[u.id] = u.profile_image_url
    }
    // Persist the merged profile map
    await setCachedProfiles(profileMap)
  }

  // ── Streams (always fresh) ──
  const streamsData = await fetchStreams(token, broadcasterIds)
  const liveMap = Object.fromEntries(streamsData.map((s) => [s.user_id, s]))

  // ── Build unified list ──
  const all = allFollows.map((f) => {
    const stream = liveMap[f.broadcaster_id]
    return stream
      ? { ...stream, profile_image_url: profileMap[f.broadcaster_id] ?? null, isLive: true }
      : {
          user_id:           f.broadcaster_id,
          user_login:        f.broadcaster_login,
          user_name:         f.broadcaster_name,
          profile_image_url: profileMap[f.broadcaster_id] ?? null,
          game_name:         null,
          viewer_count:      null,
          isLive:            false,
        }
  })

  const live    = all.filter((c) => c.isLive).sort((a, b) => b.viewer_count - a.viewer_count)
  const offline = all.filter((c) => !c.isLive)

  return { live, offline }
}

// ── Component ────────────────────────────────────────────────

export default function MainPage({ token, onLogout, onTokenRefresh, onSettings }) {
  const { t } = useI18n()
  const [liveChannels, setLiveChannels]       = useState([])
  const [offlineChannels, setOfflineChannels] = useState([])
  const [loading, setLoading]       = useState(true)   // full-screen spinner
  const [refreshing, setRefreshing] = useState(false)   // subtle top indicator
  const [error, setError]           = useState(null)
  const [query, setQuery]           = useState("")
  const mountedRef = useRef(true)

  // Update extension badge with live channel count
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "SET_BADGE", count: liveChannels.length })
  }, [liveChannels])

  useEffect(() => {
    mountedRef.current = true

    async function init() {
      try {
        // 1. Try to restore cached data instantly
        const cached = await getCachedChannels()

        if (cached?.data) {
          // Show cached data immediately (no spinner)
          setLiveChannels(cached.data.live)
          setOfflineChannels(cached.data.offline)
          setLoading(false)

          // If cache is still fresh (< 5 min), we're done
          if (cached.fresh) return

          // Otherwise: stale → revalidate in background
          setRefreshing(true)
        }
        // If no cache at all, loading spinner stays visible

        // 2. Fetch fresh data
        const { live, offline } = await fetchAllFollowed(token)

        if (!mountedRef.current) return

        setLiveChannels(live)
        setOfflineChannels(offline)
        setLoading(false)
        setRefreshing(false)

        // 3. Persist to cache
        await setCachedChannels({ live, offline })
      } catch (e) {
        console.error(e)
        if (!mountedRef.current) return

        // If token expired, try refreshing it automatically
        if (e instanceof TokenExpiredError && onTokenRefresh) {
          try {
            const newToken = await onTokenRefresh()
            if (newToken && mountedRef.current) {
              // Retry with the refreshed token
              const { live, offline } = await fetchAllFollowed(newToken)
              if (!mountedRef.current) return
              setLiveChannels(live)
              setOfflineChannels(offline)
              setLoading(false)
              setRefreshing(false)
              await setCachedChannels({ live, offline })
              return
            }
          } catch (refreshErr) {
            console.error("Auto-refresh failed:", refreshErr)
          }
        }

        // If refresh failed or error wasn't 401 → logout
        onLogout()
      }
    }

    init()
    return () => { mountedRef.current = false }
  }, [token])

  // Compute filtered lists from search query
  const { filteredLive, filteredOffline } = search(liveChannels, offlineChannels, query)

  return (
    <div className="main-root">
      {/* Header */}
      <header className="main-header">
        <div className="main-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#a970ff">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span>Twitch Sidebar</span>
        </div>
        <button id="settings-btn" className="main-settings-btn" onClick={onSettings} aria-label={t("main.settings")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.04 7.04 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
          </svg>
        </button>
      </header>

      {/* Barra de búsqueda */}
      <SearchBar query={query} setQuery={setQuery} />

      {/* Subtle refresh indicator (stale-while-revalidate) */}
      {refreshing && <div className="main-refresh-bar" />}

      {/* Error banner */}
      {error && <div className="main-error-banner">⚠ {error}</div>}

      {/* Body */}
      {loading ? (
        <div className="main-center">
          <div className="main-spinner" />
          <span className="main-loading-text">{t("main.loading")}</span>
        </div>
      ) : (
        <div className="main-scroll">
          {/* ── En vivo ── */}
          <div className="main-section-row">
            <span className="main-section-title">{t("main.live")}</span>
            <span className="main-badge">{liveChannels.length}</span>
          </div>

          {filteredLive.length === 0 ? (
            <div className="main-empty-inline">
              {query ? t("main.noResults", query) : t("main.noLive")}
            </div>
          ) : (
            <div className="main-grid">
              {filteredLive.map((ch) => (
                <TwitchCard
                  key={ch.user_id}
                  channel={ch}
                  isLive
                  onClick={(login) => chrome.tabs.create({ url: `https://twitch.tv/${login}` })}
                />
              ))}
            </div>
          )}

          {/* ── Offline ── */}
          {filteredOffline.length > 0 && (
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
                    onClick={(login) => chrome.tabs.create({ url: `https://twitch.tv/${login}` })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
