import test from "node:test"
import assert from "node:assert/strict"
import { createContext, runInContext } from "node:vm"
import { webcrypto } from "node:crypto"
import { build } from "vite"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const bundles = await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: false,
    lib: {
      entry: `${root}/src/background.js`,
      name: "TwitchSidebarBackground",
      formats: ["iife"],
      fileName: () => "background.js"
    }
  }
})
const code = bundles[0].output.find((file) => file.type === "chunk").code
const clientId = "7wvduf9b5669znfl36ey3oraencfv8"

function createHarness(mode, saved = {}, savedSession = {}) {
  const local = { ...saved }
  const session = { ...savedSession }
  const events = {}
  const notifications = []
  const requests = []
  const state = {
    live: ["1"],
    badge: "",
    refreshes: 0,
    invalidToken: null,
    followsStatus: 200,
    validationStatus: 200,
    oauthMismatch: false,
    alarmCreations: 0
  }
  const event = (name) => ({
    addListener(listener) {
      events[name] = listener
    }
  })
  const method = (operation) =>
    mode === "firefox"
      ? operation
      : (...args) => {
          const callback = args.pop()
          Promise.resolve(operation(...args)).then(callback, (error) => {
            api.runtime.lastError = { message: error.message }
            callback()
            delete api.runtime.lastError
          })
        }
  const storage = (values, area) => ({
    get: method(async (keys) => {
      const snapshot = Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys])
          .filter((key) => values[key] !== undefined)
          .map((key) => [key, values[key]])
      )
      if (state.preferenceReadGate && keys === "rememberSession") {
        state.pendingPreferenceReads = (state.pendingPreferenceReads ?? 0) + 1
        await state.preferenceReadGate
      }
      return snapshot
    }),
    set: method(async (data) => {
      if (state.failCredentialWrite === area && "twitch_refresh_token" in data) {
        state.failCredentialWrite = null
        throw new Error("Credential write failed")
      }
      if (state.failPreferenceWrite && "rememberSession" in data) {
        state.failPreferenceWrite = false
        throw new Error("Preference write failed")
      }
      if (state.writeGate && "twitch_refresh_token" in data) {
        state.pendingWrites = (state.pendingWrites ?? 0) + 1
        await state.writeGate
      }
      const changes = {}
      for (const [key, newValue] of Object.entries(data)) {
        if (JSON.stringify(values[key]) !== JSON.stringify(newValue)) {
          changes[key] = { oldValue: values[key], newValue }
        }
      }
      Object.assign(values, data)
      if (Object.keys(changes).length) events.storage?.(changes, area)
    }),
    remove: method(async (keys) => {
      const changes = {}
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (key in values) changes[key] = { oldValue: values[key] }
        delete values[key]
      }
      if (Object.keys(changes).length) events.storage?.(changes, area)
    })
  })
  const api = {
    runtime: {
      id: "test-extension",
      getURL: (path) => `moz-extension://test/${path}`,
      onMessage: event("message"),
      onInstalled: event("installed"),
      onStartup: event("startup")
    },
    storage: {
      local: storage(local, "local"),
      session: storage(session, "session"),
      onChanged: event("storage")
    },
    action: {
      onClicked: event("action"),
      setBadgeBackgroundColor: method(async () => {}),
      setBadgeText: method(async ({ text }) => {
        state.badge = text
      })
    },
    alarms: {
      get: method(async () => state.alarm),
      create: (...args) => {
        assert.equal(args.length, 2)
        const [name, options] = args
        state.alarm = { name, ...options }
        state.alarmCreations++
        return Promise.resolve()
      },
      onAlarm: event("alarm")
    },
    identity: {
      getRedirectURL: () => "https://test.extensions.allizom.org/",
      launchWebAuthFlow: method(async ({ url }) => {
        state.authUrl = new URL(url)
        const oauthState = state.oauthMismatch ? "wrong" : state.authUrl.searchParams.get("state")
        return `https://test.extensions.allizom.org/?code=code&state=${oauthState}`
      })
    },
    tabs: { create: method(async () => {}) }
  }
  if (mode === "firefox")
    api.sidebarAction = {
      toggle: method(async () => {
        state.panelOpened = true
      })
    }
  else
    api.sidePanel = {
      open: (...args) => {
        assert.equal(args.length, 1)
        state.panelOpened = true
        return Promise.resolve()
      }
    }
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status })
  const fetch = async (url, options) => {
    const requestUrl = new URL(url)
    requests.push({ url: requestUrl, options })
    const path = requestUrl.pathname
    if (path.endsWith("/refresh")) {
      state.refreshes++
      if (state.refreshGate) await state.refreshGate
      if (state.refreshFails) return response({ error: "Refresh token revoked" }, 400)
      return response({ access_token: "new", refresh_token: "rotated", expires_in: 3600 })
    }
    if (path.endsWith("/exchange")) {
      state.exchanges = (state.exchanges ?? 0) + 1
      if (state.exchangeGate) await state.exchangeGate
      return response({ access_token: "new", refresh_token: "rotated", expires_in: 3600 })
    }
    if (path.endsWith("/validate"))
      return response(
        { client_id: clientId, scopes: ["user:read:follows"] },
        state.validationStatus
      )
    if (options.headers.Authorization === `Bearer ${state.invalidToken}`) return response({}, 401)
    if (path.endsWith("/users")) {
      const ids = requestUrl.searchParams.getAll("id")
      return response({
        data: ids.length
          ? ids.map((id) => ({ id, profile_image_url: `https://static-cdn.jtvnw.net/${id}.png` }))
          : [{ id: "10" }]
      })
    }
    if (path.endsWith("/channels/followed")) {
      if (state.followsStatus !== 200) return response({}, state.followsStatus)
      return response({
        data: ["1", "2"].map((id) => ({
          broadcaster_id: id,
          broadcaster_login: `channel${id}`,
          broadcaster_name: `Channel ${id}`
        })),
        pagination: {}
      })
    }
    if (path.endsWith("/streams")) {
      assert.equal(requestUrl.searchParams.get("first"), "100")
      return response({
        data: state.live.map((id) => ({
          user_id: id,
          user_login: `channel${id}`,
          user_name: `Channel ${id}`,
          viewer_count: 10
        })),
        pagination: {}
      })
    }
    if (path.endsWith("/revoke")) {
      state.revocations = (state.revocations ?? 0) + 1
      return response({ revoked: true })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  const context = createContext({
    [mode === "firefox" ? "browser" : "chrome"]: api,
    URL,
    URLSearchParams,
    AbortSignal,
    crypto: webcrypto,
    fetch,
    console
  })
  runInContext(code, context)
  const message = (payload) =>
    new Promise((resolve) => {
      assert.equal(events.message(payload, { id: api.runtime.id }, resolve), true)
    })
  const signedIn = () => {
    session.twitch_access_token = "old"
    session.twitch_validated_at = Date.now()
    if (local.rememberSession === false) session.twitch_refresh_token = "original"
    else local.twitch_refresh_token = "original"
  }
  const settled = () => new Promise((resolve) => setImmediate(resolve))
  const setLocal = (data) =>
    mode === "firefox"
      ? api.storage.local.set(data)
      : new Promise((resolve) => api.storage.local.set(data, resolve))
  const removeLocal = (keys) =>
    mode === "firefox"
      ? api.storage.local.remove(keys)
      : new Promise((resolve) => api.storage.local.remove(keys, resolve))
  return {
    local,
    session,
    events,
    notifications,
    requests,
    state,
    message,
    signedIn,
    settled,
    setLocal,
    removeLocal
  }
}

for (const browser of ["firefox", "chrome"]) {
  test(`${browser}: initialization, sidebar gesture and empty session`, async () => {
    const harness = createHarness(browser)
    assert.equal((await harness.message({ type: "SESSION_RESTORE" })).authenticated, false)
    await harness.settled()
    assert.equal(harness.state.alarm.periodInMinutes, 3)
    harness.events.action({ windowId: 1 })
    assert.equal(harness.state.panelOpened, true)
    assert.equal((await harness.message({ type: "POLL_NOW" })).channels, null)
    assert.equal(harness.requests.length, 0)
  })

  test(`${browser}: rejected OAuth state never exchanges or stores tokens`, async () => {
    const harness = createHarness(browser)
    harness.state.oauthMismatch = true
    const result = await harness.message({ type: "TWITCH_AUTH" })
    assert.match(result.error, /Invalid OAuth/)
    assert.equal(harness.requests.length, 0)
    assert.equal(harness.session.twitch_access_token, undefined)
  })

  test(`${browser}: authentication persists tokens and requests only follows access`, async () => {
    const harness = createHarness(browser)
    const result = await harness.message({ type: "TWITCH_AUTH" })
    assert.equal(result.authenticated, true)
    assert.equal(result.access_token, undefined)
    assert.equal(harness.session.twitch_access_token, "new")
    assert.equal(harness.local.twitch_refresh_token, "rotated")
    assert.equal(harness.state.authUrl.searchParams.get("scope"), "user:read:follows")
    assert.ok(harness.state.authUrl.searchParams.get("state"))
  })

  test(`${browser}: simultaneous polls refresh once and use the new token throughout`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.invalidToken = "old"
    const results = await Promise.all([
      harness.message({ type: "POLL_NOW" }),
      harness.message({ type: "POLL_NOW" })
    ])
    assert.equal(harness.state.refreshes, 1)
    assert.equal(results[0].channels.live.length, 1)
    assert.equal(results[1].channels.live.length, 1)
    for (const request of harness.requests.filter((item) =>
      /channels\/followed|streams/.test(item.url.pathname)
    )) {
      assert.equal(request.options.headers.Authorization, "Bearer new")
    }
  })

  test(`${browser}: browser restart restores from the persistent refresh token`, async () => {
    const harness = createHarness(browser)
    harness.local.twitch_refresh_token = "original"
    assert.equal((await harness.message({ type: "SESSION_RESTORE" })).authenticated, true)
    assert.equal(harness.state.refreshes, 1)
    assert.equal(harness.session.twitch_access_token, "new")
    assert.equal(harness.local.twitch_refresh_token, "rotated")
  })

  test(`${browser}: transient Twitch errors preserve credentials and cached channels`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    const cached = { data: { live: [{ user_id: "99" }], offline: [] }, ts: 0 }
    harness.local.twitch_channels_cache = cached
    harness.state.followsStatus = 503
    assert.match((await harness.message({ type: "POLL_NOW" })).error, /503/)
    assert.equal(harness.local.twitch_channels_cache, cached)
    assert.equal(harness.local.twitch_refresh_token, "original")
    assert.equal(harness.session.twitch_access_token, "old")
  })

  test(`${browser}: a revoked token without refresh clears credentials and private cache`, async () => {
    const harness = createHarness(browser)
    harness.session.twitch_access_token = "revoked"
    harness.local.twitch_channels_cache = { data: { live: [], offline: [] }, ts: Date.now() }
    harness.state.validationStatus = 401
    assert.match((await harness.message({ type: "SESSION_RESTORE" })).error, /Sign in required/)
    assert.equal(harness.session.twitch_access_token, undefined)
    assert.equal(harness.local.twitch_channels_cache, undefined)
  })

  test(`${browser}: live transition and zero-channel badge update with favorites`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.local.notification_streamers = ["1"]
    await harness.message({ type: "POLL_NOW" })
    assert.equal(harness.state.badge, "1")
    harness.state.live = []
    await harness.message({ type: "POLL_NOW" })
    assert.equal(harness.state.badge, "")
    harness.state.live = ["1"]
    await harness.message({ type: "POLL_NOW" })
    assert.equal(harness.state.badge, "1")
  })

  test(`${browser}: concurrent favorite writes and repeated removal are safe`, async () => {
    const harness = createHarness(browser)
    await Promise.all(
      ["1", "2"].map((id) => harness.message({ type: "TOGGLE_FAVORITE", broadcasterId: id }))
    )
    assert.equal(harness.local.notification_streamers.length, 2)
    await Promise.all(
      [1, 2].map(() => harness.message({ type: "REMOVE_FAVORITE", broadcasterId: "1" }))
    )
    assert.equal(harness.local.notification_streamers.length, 1)
    assert.equal(harness.local.notification_streamers[0], "2")
  })

  test(`${browser}: logout during token refresh prevents session and cache resurrection`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.invalidToken = "old"
    let release
    harness.state.refreshGate = new Promise((resolve) => {
      release = resolve
    })
    const poll = harness.message({ type: "POLL_NOW" })
    for (let i = 0; !harness.state.refreshes && i < 100; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    assert.equal(harness.state.refreshes, 1)
    const logout = harness.message({ type: "SESSION_LOGOUT" })
    release()
    await Promise.all([poll, logout])
    assert.ok((harness.state.revocations ?? 0) >= 1)
    assert.equal(harness.session.twitch_access_token, undefined)
    assert.equal(harness.local.twitch_refresh_token, undefined)
    assert.equal(harness.local.twitch_channels_cache, undefined)
    assert.equal(harness.local.previously_live, undefined)
    assert.equal(harness.state.badge, "")
  })

  test(`${browser}: opening a fresh cached list refreshes both channels and the badge`, async () => {
    const harness = createHarness(browser, {
      twitch_channels_cache: { data: { live: [{ user_id: "99" }], offline: [] }, ts: Date.now() }
    })
    harness.signedIn()
    harness.state.live = ["1", "2"]
    const result = await harness.message({ type: "LOAD_CHANNELS" })
    assert.equal(result.channels.live.length, 2)
    assert.ok(harness.requests.some(({ url }) => url.pathname.endsWith("/streams")))
    assert.equal(harness.state.badge, "2")
    assert.equal(result.updatedAt, harness.local.twitch_channels_cache.ts)
  })

  test(`${browser}: a scheduled alarm updates cached channels and the live badge without a panel`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.live = ["1", "2"]
    await harness.events.alarm({ name: "twitch_poll_streams" })
    assert.equal(harness.local.twitch_channels_cache.data.live.length, 2)
    assert.equal(harness.state.badge, "2")
    harness.state.live = []
    await harness.events.alarm({ name: "twitch_poll_streams" })
    assert.equal(harness.local.twitch_channels_cache.data.live.length, 0)
    assert.equal(harness.state.badge, "")
  })

  test(`${browser}: waking the background restores the badge from the saved list`, async () => {
    const harness = createHarness(browser, {
      twitch_channels_cache: {
        data: { live: [{ user_id: "1" }, { user_id: "2" }], offline: [] },
        ts: 0
      }
    })
    await harness.settled()
    assert.equal(harness.state.badge, "2")
    assert.equal(harness.requests.length, 0)
    await harness.removeLocal("twitch_channels_cache")
    await harness.settled()
    assert.equal(harness.state.badge, "")
  })

  test(`${browser}: changing the interval replaces the alarm immediately and persists after restart`, async () => {
    const harness = createHarness(browser)
    await harness.settled()
    assert.equal(harness.state.alarm.periodInMinutes, 3)
    const result = await harness.message({ type: "SET_POLL_INTERVAL", minutes: 1 })
    assert.equal(result.pollIntervalMinutes, 1)
    assert.equal(harness.local.pollIntervalMinutes, 1)
    assert.equal(harness.state.alarm.periodInMinutes, 1)
    assert.equal(harness.state.alarmCreations, 2)
    const restarted = createHarness(browser, harness.local)
    await restarted.settled()
    assert.equal(restarted.state.alarm.periodInMinutes, 1)
    restarted.state.alarm = undefined
    restarted.events.startup()
    await restarted.settled()
    assert.equal(restarted.state.alarm.periodInMinutes, 1)
  })

  test(`${browser}: invalid refresh intervals leave the saved interval and alarm intact`, async () => {
    const harness = createHarness(browser, { pollIntervalMinutes: 10 })
    await harness.settled()
    for (const minutes of [0, 0.5, 4, 1440, "5", null]) {
      assert.match(
        (await harness.message({ type: "SET_POLL_INTERVAL", minutes })).error,
        /Invalid refresh interval/
      )
    }
    assert.equal(harness.local.pollIntervalMinutes, 10)
    assert.equal(harness.state.alarm.periodInMinutes, 10)
    assert.equal(harness.state.alarmCreations, 1)
  })

  test(`${browser}: storage preference changes reschedule the shared alarm`, async () => {
    const harness = createHarness(browser)
    await harness.settled()
    await harness.setLocal({ pollIntervalMinutes: 30 })
    await harness.settled()
    assert.equal(harness.state.alarm.periodInMinutes, 30)
    await harness.removeLocal("pollIntervalMinutes")
    await harness.settled()
    assert.equal(harness.state.alarm.periodInMinutes, 3)
  })

  test(`${browser}: favorite priority is optional, persistent and uses existing bell preferences`, async () => {
    const harness = createHarness(browser, { notification_streamers: ["1"] })
    assert.equal(
      (await harness.message({ type: "SET_FAVORITES_FIRST", enabled: true })).favoritesFirst,
      true
    )
    assert.equal(harness.local.favoritesFirst, true)
    assert.deepEqual(harness.local.notification_streamers, ["1"])
    assert.match(
      (await harness.message({ type: "SET_FAVORITES_FIRST", enabled: "true" })).error,
      /Invalid favorite/
    )
    assert.equal(harness.local.favoritesFirst, true)
    await harness.message({ type: "SET_FAVORITES_FIRST", enabled: false })
    assert.equal(harness.local.favoritesFirst, false)
    assert.deepEqual(harness.local.notification_streamers, ["1"])
  })

  test(`${browser}: a failed old refresh cannot cancel a newer login`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.invalidToken = "old"
    harness.state.refreshFails = true
    let releaseRefresh, releaseExchange
    harness.state.refreshGate = new Promise((resolve) => {
      releaseRefresh = resolve
    })
    harness.state.exchangeGate = new Promise((resolve) => {
      releaseExchange = resolve
    })
    const oldPoll = harness.message({ type: "POLL_NOW" })
    for (let i = 0; !harness.state.refreshes && i < 100; i++) await harness.settled()
    assert.equal(harness.state.refreshes, 1)
    const login = harness.message({ type: "TWITCH_AUTH" })
    for (let i = 0; !harness.state.exchanges && i < 100; i++) await harness.settled()
    assert.equal(harness.state.exchanges, 1)
    releaseRefresh()
    assert.equal((await oldPoll).code, "SESSION_CHANGED")
    releaseExchange()
    assert.equal((await login).authenticated, true)
    assert.equal(harness.session.twitch_access_token, "new")
    assert.equal(harness.local.twitch_refresh_token, "rotated")
  })

  test(`${browser}: validation failures preserve the session and can be retried without exposing tokens`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.session.twitch_validated_at = 0
    harness.state.validationStatus = 503
    const failure = await harness.message({ type: "SESSION_RESTORE" })
    assert.match(failure.error, /503/)
    assert.notEqual(failure.code, "AUTH_REQUIRED")
    assert.equal(harness.session.twitch_access_token, "old")
    assert.equal(harness.local.twitch_refresh_token, "original")
    harness.state.validationStatus = 200
    const restored = await harness.message({ type: "SESSION_RESTORE" })
    assert.equal(restored.authenticated, true)
    assert.deepEqual(Object.keys(restored), ["authenticated"])
  })

  test(`${browser}: disabling remembered sessions migrates and rotates tokens only in session storage`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    assert.equal(
      (await harness.message({ type: "SET_REMEMBER_SESSION", enabled: false })).rememberSession,
      false
    )
    assert.equal(harness.local.rememberSession, false)
    assert.equal(harness.local.twitch_refresh_token, undefined)
    assert.equal(harness.session.twitch_refresh_token, "original")
    harness.state.invalidToken = "old"
    await harness.message({ type: "POLL_NOW" })
    assert.equal(harness.session.twitch_refresh_token, "rotated")
    assert.equal(harness.local.twitch_refresh_token, undefined)
    const workerRestart = createHarness(browser, harness.local, harness.session)
    assert.equal((await workerRestart.message({ type: "SESSION_RESTORE" })).authenticated, true)
    const browserRestart = createHarness(browser, harness.local)
    assert.equal((await browserRestart.message({ type: "SESSION_RESTORE" })).authenticated, false)
    assert.equal(browserRestart.state.refreshes, 0)
    await harness.message({ type: "SET_REMEMBER_SESSION", enabled: true })
    assert.equal(harness.local.twitch_refresh_token, "rotated")
    assert.equal(harness.session.twitch_refresh_token, undefined)
    assert.equal(
      (await createHarness(browser, harness.local).message({ type: "SESSION_RESTORE" }))
        .authenticated,
      true
    )
  })

  test(`${browser}: login respects session-only mode and logout clears both credential stores`, async () => {
    const harness = createHarness(browser, { rememberSession: false })
    assert.equal((await harness.message({ type: "TWITCH_AUTH" })).authenticated, true)
    assert.equal(harness.local.twitch_refresh_token, undefined)
    assert.equal(harness.session.twitch_refresh_token, "rotated")
    await harness.message({ type: "SESSION_LOGOUT" })
    assert.ok((harness.state.revocations ?? 0) >= 1)
    assert.equal(harness.session.twitch_access_token, undefined)
    assert.equal(harness.session.twitch_refresh_token, undefined)
    assert.equal(harness.local.twitch_refresh_token, undefined)
    assert.equal(harness.local.rememberSession, false)
  })

  test(`${browser}: concurrent persistence changes preserve the latest rotated credential`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.invalidToken = "old"
    let release
    harness.state.refreshGate = new Promise((resolve) => {
      release = resolve
    })
    const poll = harness.message({ type: "POLL_NOW" })
    for (let i = 0; !harness.state.refreshes && i < 100; i++) await harness.settled()
    await Promise.all(
      [false, true, false].map((enabled) =>
        harness.message({ type: "SET_REMEMBER_SESSION", enabled })
      )
    )
    release()
    await poll
    assert.equal(harness.local.rememberSession, false)
    assert.equal(harness.local.twitch_refresh_token, undefined)
    assert.equal(harness.session.twitch_refresh_token, "rotated")
    assert.match(
      (await harness.message({ type: "SET_REMEMBER_SESSION", enabled: "false" })).error,
      /Invalid session/
    )
    assert.equal(harness.session.twitch_refresh_token, "rotated")
  })

  test(`${browser}: logout waits for credential migration and prevents resurrection`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    let release
    harness.state.writeGate = new Promise((resolve) => {
      release = resolve
    })
    const migration = harness.message({ type: "SET_REMEMBER_SESSION", enabled: false })
    for (let i = 0; !harness.state.pendingWrites && i < 100; i++) await harness.settled()
    assert.equal(harness.state.pendingWrites, 1)
    const logout = harness.message({ type: "SESSION_LOGOUT" })
    release()
    assert.equal((await migration).code, "SESSION_CHANGED")
    assert.equal((await logout).ok, true)
    assert.equal(harness.session.twitch_refresh_token, undefined)
    assert.equal(harness.session.twitch_access_token, undefined)
    assert.equal(harness.local.twitch_refresh_token, undefined)
  })

  test(`${browser}: moving credentials during a refresh-token read cannot lose the session`, async () => {
    const harness = createHarness(browser)
    harness.signedIn()
    harness.state.invalidToken = "old"
    let release
    harness.state.preferenceReadGate = new Promise((resolve) => {
      release = resolve
    })
    const poll = harness.message({ type: "POLL_NOW" })
    for (let i = 0; !harness.state.pendingPreferenceReads && i < 100; i++) await harness.settled()
    assert.equal(harness.state.pendingPreferenceReads, 1)
    const migration = harness.message({ type: "SET_REMEMBER_SESSION", enabled: false })
    await harness.settled()
    release()
    const [result] = await Promise.all([poll, migration])
    assert.equal(result.channels.live.length, 1)
    assert.equal(harness.session.twitch_access_token, "new")
    assert.equal(harness.session.twitch_refresh_token, "rotated")
    assert.equal(harness.local.twitch_refresh_token, undefined)
  })

  test(`${browser}: failed credential migrations preserve the original session and persistence mode`, async () => {
    for (const previous of [true, false]) {
      const harness = createHarness(browser, { rememberSession: previous })
      harness.signedIn()
      if (previous) harness.state.failCredentialWrite = "session"
      else harness.state.failPreferenceWrite = true
      const result = await harness.message({ type: "SET_REMEMBER_SESSION", enabled: !previous })
      assert.match(result.error, /write failed/)
      assert.equal(harness.local.rememberSession, previous)
      assert.equal(harness.local.twitch_refresh_token, previous ? "original" : undefined)
      assert.equal(harness.session.twitch_refresh_token, previous ? undefined : "original")
      assert.equal((await harness.message({ type: "SESSION_RESTORE" })).authenticated, true)
    }
  })
}
