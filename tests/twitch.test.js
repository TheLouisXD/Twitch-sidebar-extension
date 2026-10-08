import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

const originalFetch = globalThis.fetch
let profilesCache
globalThis.browser = {
  runtime: { id: "test" },
  storage: {
    local: {
      async get() {
        return { twitch_profiles_cache: profilesCache }
      }
    }
  }
}
const { fetchBatch, fetchAllFollowed, fetchTwitch } = await import("../src/twitch.js")
const { AuthError } = await import("../src/auth.js")
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => {
  globalThis.fetch = originalFetch
  profilesCache = undefined
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
