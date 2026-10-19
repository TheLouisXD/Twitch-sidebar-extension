import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

const originalFetch = globalThis.fetch
let profilesCache
let followsCache
let userProfileCache
globalThis.browser = {
  runtime: { id: "test" },
  storage: {
    local: {
      async get() {
        return {
          twitch_profiles_cache: profilesCache,
          twitch_follows_cache: followsCache,
          twitch_user_profile_cache: userProfileCache
        }
      }
    }
  }
}
const { BATCH_CONCURRENCY, fetchBatch, fetchAllFollowed, fetchTwitch, formatAvatarUrl } =
  await import("../src/twitch.js")
const { AuthError } = await import("../src/auth.js")
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => {
  globalThis.fetch = originalFetch
  profilesCache = undefined
  followsCache = undefined
  userProfileCache = undefined
})

test("stream batches request 100, follow pagination and split IDs", async () => {
  const ids = Array.from({ length: 125 }, (_, i) => String(i + 1))
  const requests = []
  globalThis.fetch = async (url) => {
    const params = new URL(url).searchParams
    requests.push(params)
    assert.equal(params.get("first"), "100")
    const pageIds = params.getAll("user_id")
    if (pageIds.length === 100 && !params.has("after")) {
      return json({
        data: pageIds.slice(0, 60).map((user_id) => ({ user_id })),
        pagination: { cursor: "second" }
      })
    }
    return json({
      data: (pageIds.length === 100 ? pageIds.slice(60) : pageIds).map((user_id) => ({ user_id })),
      pagination: {}
    })
  }
  const streams = await fetchBatch("token", "streams", "user_id", ids)
  assert.equal(streams.length, 125)
  assert.equal(requests.length, 3)
  assert.equal(new Set(streams.map((stream) => stream.user_id)).size, 125)
})

test("fetchBatch runs chunks in parallel up to BATCH_CONCURRENCY and preserves order", async () => {
  const ids = Array.from({ length: 650 }, (_, i) => String(i + 1))
  let inFlight = 0
  let maxInFlight = 0
  globalThis.fetch = async (url) => {
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 10))
    inFlight--
    const pageIds = new URL(url).searchParams.getAll("id")
    return json({ data: pageIds.map((id) => ({ id })) })
  }
  const results = await fetchBatch("token", "users", "id", ids)
  assert.equal(maxInFlight, BATCH_CONCURRENCY)
  assert.deepEqual(
    results.map((item) => item.id),
    ids
  )
})

test("HTTP failures from any Twitch endpoint reject instead of becoming empty lists", async () => {
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401)
  await assert.rejects(fetchTwitch("token", "channels/followed"), AuthError)
  globalThis.fetch = async () => json({ error: "Rate limited" }, 429)
  await assert.rejects(fetchBatch("token", "streams", "user_id", ["1"]), /429/)
})

test("a repeated stream pagination cursor rejects instead of looping forever", async () => {
  globalThis.fetch = async () => json({ data: [], pagination: { cursor: "same" } })
  await assert.rejects(fetchBatch("token", "streams", "user_id", ["1"]), /Repeated Twitch/)
})

test("no follows produces a fresh empty channel snapshot without unfiltered stream requests", async () => {
  const paths = []
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname
    paths.push(path)
    return json({ data: path.endsWith("/users") ? [{ id: "10" }] : [], pagination: {} })
  }
  assert.deepEqual((await fetchAllFollowed("token")).data, { live: [], offline: [] })
  assert.deepEqual(paths, ["/helix/users", "/helix/channels/followed"])
})

test("follow pagination is complete and an expired profile cache is refreshed", async () => {
  profilesCache = { map: { 1: "old-image" }, ts: Date.now() - 25 * 60 * 60 * 1000 }
  let profileRequests = 0
  globalThis.fetch = async (url) => {
    const { pathname, searchParams } = new URL(url)
    if (pathname.endsWith("/users")) {
      const ids = searchParams.getAll("id")
      if (!ids.length) return json({ data: [{ id: "10" }] })
      profileRequests++
      return json({ data: ids.map((id) => ({ id, profile_image_url: `new-${id}` })) })
    }
    if (pathname.endsWith("/channels/followed")) {
      const secondPage = searchParams.has("after")
      const id = secondPage ? "2" : "1"
      return json({
        data: [
          {
            broadcaster_id: id,
            broadcaster_login: `channel${id}`,
            broadcaster_name: `Channel ${id}`
          }
        ],
        pagination: secondPage ? {} : { cursor: "second" }
      })
    }
    return json({ data: [{ user_id: "1", viewer_count: 100 }], pagination: {} })
  }
  const result = await fetchAllFollowed("token")
  assert.equal(result.data.live[0].profile_image_url, "new-1")
  assert.equal(result.data.offline[0].user_id, "2")
  assert.equal(profileRequests, 1)
  assert.equal(result.profilesChanged, true)
})

test("fresh follows and profile caches query only streams on open", async () => {
  followsCache = {
    follows: [
      { broadcaster_id: "1", broadcaster_login: "ch1", broadcaster_name: "Channel 1" },
      { broadcaster_id: "2", broadcaster_login: "ch2", broadcaster_name: "Channel 2" }
    ],
    userId: "10",
    ts: Date.now()
  }
  profilesCache = {
    map: { 1: "https://static-cdn.jtvnw.net/1.png", 2: "https://static-cdn.jtvnw.net/2.png" },
    ts: Date.now()
  }
  userProfileCache = { profile: { id: "10", login: "me" }, ts: Date.now() }
  const paths = []
  globalThis.fetch = async (url) => {
    paths.push(new URL(url).pathname)
    return json({ data: [{ user_id: "2", viewer_count: 55 }], pagination: {} })
  }
  const result = await fetchAllFollowed("token")
  assert.deepEqual(paths, ["/helix/streams"])
  assert.equal(result.followsChanged, false)
  assert.equal(result.profilesChanged, false)
  assert.equal(result.data.live.length, 1)
  assert.equal(result.data.live[0].user_id, "2")
  assert.equal(result.data.offline.length, 1)
  assert.equal(result.data.offline[0].user_id, "1")
})

test("expired follows cache prioritizes streams and emits progressive snapshot before reconciliation finishes", async () => {
  followsCache = {
    follows: [{ broadcaster_id: "1", broadcaster_login: "ch1", broadcaster_name: "Channel 1" }],
    userId: "10",
    ts: Date.now() - 2 * 60 * 60 * 1000
  }
  profilesCache = {
    map: { 1: "https://static-cdn.jtvnw.net/1.png", 2: "https://static-cdn.jtvnw.net/2.png" },
    ts: Date.now()
  }
  userProfileCache = { profile: { id: "10", login: "me" }, ts: Date.now() }

  let releaseFollows
  const followsGate = new Promise((resolve) => {
    releaseFollows = resolve
  })
  const progressSnapshots = []

  globalThis.fetch = async (url) => {
    const { pathname, searchParams } = new URL(url)
    if (pathname.endsWith("/channels/followed")) {
      await followsGate
      return json({
        data: [
          { broadcaster_id: "1", broadcaster_login: "ch1", broadcaster_name: "Channel 1" },
          { broadcaster_id: "2", broadcaster_login: "ch2", broadcaster_name: "Channel 2" }
        ],
        pagination: {}
      })
    }
    if (pathname.endsWith("/streams")) {
      const requested = searchParams.getAll("user_id")
      return json({
        data: requested.map((user_id) => ({ user_id, viewer_count: user_id === "2" ? 90 : 30 })),
        pagination: {}
      })
    }
    throw new Error(`Unexpected endpoint: ${pathname}`)
  }

  const poll = fetchAllFollowed("token", {
    onProgress: async (snapshot) => {
      progressSnapshots.push(snapshot)
      releaseFollows()
    }
  })
  const result = await poll
  assert.equal(progressSnapshots.length, 1)
  assert.deepEqual(
    progressSnapshots[0].live.map((c) => c.user_id),
    ["1"]
  )
  assert.equal(result.progressed, true)
  assert.equal(result.followsChanged, true)
  assert.equal(result.followsListChanged, true)
  assert.deepEqual(
    result.data.live.map((c) => c.user_id),
    ["2", "1"]
  )
})

test("formatAvatarUrl optimizes 300x300 URLs and preserves other sources", () => {
  assert.equal(
    formatAvatarUrl("https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png"),
    "https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-150x150.png"
  )
  assert.equal(
    formatAvatarUrl(
      "https://static-cdn.jtvnw.net/user-default-pictures-uv/xyz-profile_image-300x300.png"
    ),
    "https://static-cdn.jtvnw.net/user-default-pictures-uv/xyz-profile_image-150x150.png"
  )
  assert.equal(
    formatAvatarUrl(
      "https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png",
      "70x70"
    ),
    "https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-70x70.png"
  )
  assert.equal(formatAvatarUrl("https://example.com/custom.png"), "https://example.com/custom.png")
  assert.equal(formatAvatarUrl(null), null)
  assert.equal(formatAvatarUrl(undefined), null)
})
