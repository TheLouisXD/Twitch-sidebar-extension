import { API_URL, CLIENT_ID } from "./config.js"
import { AuthError } from "./auth.js"
import { getCachedFollows, getCachedProfiles, getCachedUserProfile } from "./cache.js"

export const BATCH_CONCURRENCY = 4

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

/** Downscale 300x300 Twitch CDN avatars; leave other URLs untouched. */
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

async function fetchChunk(token, path, key, chunk) {
  const results = []
  const params = new URLSearchParams(path === "streams" ? { first: "100" } : {})
  for (const id of chunk) params.append(key, id)
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
  return results
}

export async function fetchBatch(token, path, key, ids, concurrency = BATCH_CONCURRENCY) {
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100))
  }
  const pages = new Array(chunks.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
    while (nextIndex < chunks.length) {
      const index = nextIndex++
      pages[index] = await fetchChunk(token, path, key, chunks[index])
    }
  })
  await Promise.all(workers)
  return pages.flat()
}

function buildChannelSnapshot(follows, streams, profileMap) {
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
    live: channels
      .filter((channel) => channel.isLive)
      .sort((a, b) => b.viewer_count - a.viewer_count),
    offline: channels.filter((channel) => !channel.isLive)
  }
}

function haveFollowsChanged(previous, next) {
  if (!Array.isArray(previous) || previous.length !== next.length) return true
  for (let i = 0; i < previous.length; i++) {
    if (
      previous[i].broadcaster_id !== next[i].broadcaster_id ||
      previous[i].broadcaster_login !== next[i].broadcaster_login ||
      previous[i].broadcaster_name !== next[i].broadcaster_name
    ) {
      return true
    }
  }
  return false
}

export async function fetchAllFollowed(token, options = {}) {
  const [{ map: cachedProfiles, fresh: profilesFresh }, cachedFollows, cachedUser] =
    await Promise.all([getCachedProfiles(), getCachedFollows(), getCachedUserProfile()])
  const profileMap = profilesFresh ? { ...cachedProfiles } : {}
  const knownAvatarMap = { ...cachedProfiles, ...profileMap }
  let progressed = false

  const resolveUser = async () =>
    cachedUser?.fresh && cachedUser.profile?.id ? cachedUser.profile : fetchUser(token)

  let user
  let follows
  let followsChanged = false
  let followsListChanged = false
  let streams

  const loadStreamsAndProfiles = async (followList) => {
    const ids = [...new Set(followList.map((follow) => follow.broadcaster_id))]
    const missing = ids.filter((id) => !Object.hasOwn(profileMap, id))
    let profilesDone = missing.length === 0
    const profilesPromise = missing.length
      ? fetchBatch(token, "users", "id", missing).finally(() => {
          profilesDone = true
        })
      : Promise.resolve([])
    profilesPromise.catch(() => {})

    streams = await fetchBatch(token, "streams", "user_id", ids)

    if (!profilesDone && options.onProgress) {
      progressed = true
      await options.onProgress(buildChannelSnapshot(followList, streams, knownAvatarMap))
    }

    const profiles = await profilesPromise
    for (const profile of profiles) {
      profileMap[profile.id] = formatAvatarUrl(profile.profile_image_url)
    }
  }

  if (cachedFollows.fresh && cachedFollows.follows) {
    follows = cachedFollows.follows
    user = cachedUser?.profile?.id ? cachedUser.profile : null
    await loadStreamsAndProfiles(follows)
  } else if (cachedFollows.follows?.length) {
    // Prioritize live stream state using the cached follow IDs while reconciling
    // the full follow list concurrently.
    const previousFollows = cachedFollows.follows
    const previousIds = [...new Set(previousFollows.map((follow) => follow.broadcaster_id))]
    let reconcileDone = false

    const reconcilePromise = (async () => {
      const resolvedUser = await resolveUser()
      try {
        const resolvedFollows = await fetchFollowed(token, resolvedUser.id)
        return { resolvedUser, resolvedFollows }
      } finally {
        reconcileDone = true
      }
    })()
    reconcilePromise.catch(() => {})

    const initialStreams = await fetchBatch(token, "streams", "user_id", previousIds)

    if (!reconcileDone && options.onProgress) {
      progressed = true
      await options.onProgress(
        buildChannelSnapshot(previousFollows, initialStreams, knownAvatarMap)
      )
    }

    const { resolvedUser, resolvedFollows } = await reconcilePromise
    user = resolvedUser
    follows = resolvedFollows
    followsChanged = true
    followsListChanged = haveFollowsChanged(previousFollows, follows)

    const ids = [...new Set(follows.map((follow) => follow.broadcaster_id))]
    const previousIdSet = new Set(previousIds)
    const addedIds = ids.filter((id) => !previousIdSet.has(id))
    const missing = ids.filter((id) => !Object.hasOwn(profileMap, id))

    const [addedStreams, profiles] = await Promise.all([
      addedIds.length ? fetchBatch(token, "streams", "user_id", addedIds) : [],
      missing.length ? fetchBatch(token, "users", "id", missing) : []
    ])

    streams = addedStreams.length ? [...initialStreams, ...addedStreams] : initialStreams
    for (const profile of profiles) {
      profileMap[profile.id] = formatAvatarUrl(profile.profile_image_url)
    }
  } else {
    user = await resolveUser()
    follows = await fetchFollowed(token, user.id)
    followsChanged = true
    followsListChanged = true
    await loadStreamsAndProfiles(follows)
  }

  const missingCount = follows.some(
    (follow) => !Object.hasOwn(cachedProfiles, follow.broadcaster_id)
  )
  const data = buildChannelSnapshot(follows, streams, profileMap)
  return {
    data,
    profileMap,
    profilesChanged: !profilesFresh || missingCount,
    follows,
    followsChanged,
    followsListChanged,
    user,
    progressed
  }
}
