import { API_URL, CLIENT_ID } from "./config.js"
import { AuthError } from "./auth.js"
import { getCachedProfiles } from "./cache.js"

export async function fetchTwitch(token, path, params = new URLSearchParams()) {
  const response = await fetch(`${API_URL}/${path}?${params}`, {
    headers: { "Client-ID": CLIENT_ID, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000)
  })
  if (response.status === 401) throw new AuthError("Token expired")
  if (!response.ok) throw new Error(`Twitch API error: ${response.status}`)
  const result = await response.json()
  if (!Array.isArray(result.data)) throw new Error("Invalid Twitch response")
  return result
}

/**
 * Reduces avatar image resolution from 300x300 to 150x150 for faster network transfer.
 * Preserves the original URL if not matching the standard pattern.
 * @param {string|null} url
 * @param {string} [size="150x150"]
 * @returns {string|null}
 */
export function formatAvatarUrl(url, size = "150x150") {
  if (!url || typeof url !== "string") return null
  if (url.startsWith("https://")) {
    return url.replace("300x300", size)
  }
  return url
}

export async function fetchUser(token) {
  const user = (await fetchTwitch(token, "users")).data[0]
  if (!user?.id) throw new Error("Twitch user missing")
  return user
}

async function fetchFollowed(token, userId) {
  const follows = []
  const seen = new Set()
  let cursor
  do {
    const params = new URLSearchParams({ user_id: userId, first: "100" })
    if (cursor) params.set("after", cursor)
    const page = await fetchTwitch(token, "channels/followed", params)
    follows.push(...page.data)
    cursor = page.pagination?.cursor
    if (cursor && seen.has(cursor)) throw new Error("Repeated Twitch pagination cursor")
    if (cursor) seen.add(cursor)
  } while (cursor)
  return follows
}

export async function fetchBatch(token, path, key, ids) {
  const results = []
  for (let i = 0; i < ids.length; i += 100) {
    const params = new URLSearchParams(path === "streams" ? { first: "100" } : {})
    for (const id of ids.slice(i, i + 100)) params.append(key, id)
    // Get Streams defaults to 20 results. Request 100 and follow pagination.
    const seen = new Set()
    let cursor
    do {
      if (cursor) params.set("after", cursor)
      const page = await fetchTwitch(token, path, params)
      results.push(...page.data)
      cursor = path === "streams" ? page.pagination?.cursor : null
      if (cursor && seen.has(cursor)) throw new Error("Repeated Twitch pagination cursor")
      if (cursor) seen.add(cursor)
    } while (cursor)
  }
  return results
}

export async function fetchAllFollowed(token) {
  const user = await fetchUser(token)
  const follows = await fetchFollowed(token, user.id)
  const ids = [...new Set(follows.map((follow) => follow.broadcaster_id))]
  const { map: cachedProfiles, fresh } = await getCachedProfiles()
  const profileMap = fresh ? { ...cachedProfiles } : {}
  const missing = ids.filter((id) => !Object.hasOwn(profileMap, id))
  const profiles = await fetchBatch(token, "users", "id", missing)
  for (const profile of profiles)
    profileMap[profile.id] = formatAvatarUrl(profile.profile_image_url)
  const streams = await fetchBatch(token, "streams", "user_id", ids)
  const liveMap = new Map(streams.map((stream) => [stream.user_id, stream]))
  const channels = follows.map((follow) => {
    const stream = liveMap.get(follow.broadcaster_id)
    return {
      user_id: follow.broadcaster_id,
      user_login: follow.broadcaster_login,
      user_name: follow.broadcaster_name,
      game_name: null,
      viewer_count: null,
      ...stream,
      profile_image_url: formatAvatarUrl(profileMap[follow.broadcaster_id]) ?? null,
      isLive: Boolean(stream)
    }
  })
  return {
    data: {
      live: channels
        .filter((channel) => channel.isLive)
        .sort((a, b) => b.viewer_count - a.viewer_count),
      offline: channels.filter((channel) => !channel.isLive)
    },
    profileMap,
    profilesChanged: !fresh || missing.length > 0,
    user
  }
}
