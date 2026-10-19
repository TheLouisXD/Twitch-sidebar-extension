import { localGet, localSet, localRemove, sendMessage } from "./platform.js"

export const CHANNELS_KEY = "twitch_channels_cache"
export const FOLLOWS_KEY = "twitch_follows_cache"
export const PROFILES_KEY = "twitch_profiles_cache"
export const USER_PROFILE_KEY = "twitch_user_profile_cache"
export const NOTIFICATIONS_KEY = "notification_streamers"
export const EMPTY_NOTIFICATION_IDS = []
export const FOLLOWS_TTL = 60 * 60 * 1000
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

function isFresh(timestamp, maxAge) {
  const age = Date.now() - timestamp
  return Number.isFinite(timestamp) && age >= 0 && age < maxAge
}

// The image origin must stay listed in `connect-src` of both manifests; `img-src`
// only covers <img> tags and would not allow this fetch.
export async function fetchImageAsDataUrl(url) {
  if (!url || typeof url !== "string") return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

export async function getCachedChannels() {
  const { [CHANNELS_KEY]: entry } = await localGet(CHANNELS_KEY)
  if (!decodeChannelCache(entry)) return null
  return { data: entry.data, ts: entry.ts }
}

export function decodeChannelCache(entry) {
  return Array.isArray(entry?.data?.live) && Array.isArray(entry?.data?.offline) ? entry : null
}

export function decodeFollowsCache(entry) {
  if (!Array.isArray(entry?.follows)) return null
  const valid = entry.follows.every(
    (follow) =>
      follow &&
      typeof follow.broadcaster_id === "string" &&
      typeof follow.broadcaster_login === "string" &&
      typeof follow.broadcaster_name === "string"
  )
  return valid ? entry : null
}

export async function getCachedFollows() {
  const { [FOLLOWS_KEY]: entry } = await localGet(FOLLOWS_KEY)
  const decoded = decodeFollowsCache(entry)
  if (!decoded) return { follows: null, userId: null, ts: 0, fresh: false }
  return {
    follows: decoded.follows,
    userId: typeof decoded.userId === "string" ? decoded.userId : null,
    ts: decoded.ts,
    fresh: isFresh(decoded.ts, FOLLOWS_TTL)
  }
}

export function setCachedFollows(follows, userId = null) {
  return localSet({ [FOLLOWS_KEY]: { follows, userId, ts: Date.now() } })
}

export function decodeNotificationIds(ids) {
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && /^\d+$/.test(id)) : []
}

export async function setCachedChannels(data) {
  const entry = { data, ts: Date.now() }
  await localSet({ [CHANNELS_KEY]: entry })
  return entry
}

export async function getCachedProfiles() {
  const { [PROFILES_KEY]: entry } = await localGet(PROFILES_KEY)
  return { map: entry?.map ?? {}, fresh: isFresh(entry?.ts, TWENTY_FOUR_HOURS) }
}

export function setCachedProfiles(map) {
  return localSet({ [PROFILES_KEY]: { map, ts: Date.now() } })
}

export async function getCachedUserProfile() {
  const { [USER_PROFILE_KEY]: entry } = await localGet(USER_PROFILE_KEY)
  if (!entry?.profile) return null
  return { profile: entry.profile, ts: entry.ts, fresh: isFresh(entry.ts, TWENTY_FOUR_HOURS) }
}

export async function setCachedUserProfile(profile) {
  if (!profile) return
  if (!profile.avatar_data && profile.profile_image_url && typeof fetch === "function") {
    profile.avatar_data = await fetchImageAsDataUrl(profile.profile_image_url).catch(() => null)
  }
  return localSet({ [USER_PROFILE_KEY]: { profile, ts: Date.now() } })
}

// Channel, follow and profile caches belong to the signed-in account. The favorite list
// is dropped as well on purpose: signing out must leave no account data behind.
export function clearAllCache() {
  return localRemove([CHANNELS_KEY, FOLLOWS_KEY, PROFILES_KEY, USER_PROFILE_KEY, NOTIFICATIONS_KEY])
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

export function removeFavoriteStreamer(broadcasterId) {
  return sendMessage({ type: "REMOVE_FAVORITE", broadcasterId })
}
