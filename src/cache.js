import { localGet, localSet, localRemove, sendMessage } from "./platform.js"
import { POLL_INTERVAL_KEY, normalizePollInterval } from "./preferences.js"

export const CHANNELS_KEY = "twitch_channels_cache"
export const PROFILES_KEY = "twitch_profiles_cache"
export const NOTIFICATIONS_KEY = "notification_streamers"
export const PREV_LIVE_KEY = "previously_live"
export const EMPTY_NOTIFICATION_IDS = []
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

function isFresh(timestamp, maxAge) {
  const age = Date.now() - timestamp
  return Number.isFinite(timestamp) && age >= 0 && age < maxAge
}

export async function getCachedChannels() {
  const { [CHANNELS_KEY]: entry, [POLL_INTERVAL_KEY]: interval } = await localGet([
    CHANNELS_KEY,
    POLL_INTERVAL_KEY
  ])
  if (!decodeChannelCache(entry)) return null
  return {
    data: entry.data,
    ts: entry.ts,
    fresh: isFresh(entry.ts, normalizePollInterval(interval) * 60 * 1000)
  }
}

export function decodeChannelCache(entry) {
  return Array.isArray(entry?.data?.live) && Array.isArray(entry?.data?.offline) ? entry : null
}

export function decodeNotificationIds(ids) {
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && /^\d+$/.test(id)) : []
}

export function setCachedChannels(data) {
  return localSet({ [CHANNELS_KEY]: { data, ts: Date.now() } })
}

export async function getCachedProfiles() {
  const { [PROFILES_KEY]: entry } = await localGet(PROFILES_KEY)
  return { map: entry?.map ?? {}, fresh: isFresh(entry?.ts, TWENTY_FOUR_HOURS) }
}

export function setCachedProfiles(map) {
  return localSet({ [PROFILES_KEY]: { map, ts: Date.now() } })
}

export function clearAllCache() {
  return localRemove([CHANNELS_KEY, PROFILES_KEY, NOTIFICATIONS_KEY, PREV_LIVE_KEY])
}

export async function getNotificationStreamers() {
  const { [NOTIFICATIONS_KEY]: ids } = await localGet(NOTIFICATIONS_KEY)
  return new Set(decodeNotificationIds(ids))
}

// All read/modify/write operations run in the background, shared by all sidebars.
export async function toggleNotificationStreamer(broadcasterId) {
  return (await sendMessage({ type: "TOGGLE_NOTIFICATION", broadcasterId })).active
}

export function removeNotificationStreamer(broadcasterId) {
  return sendMessage({ type: "REMOVE_NOTIFICATION", broadcasterId })
}
