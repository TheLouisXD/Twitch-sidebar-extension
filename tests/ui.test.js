import test, { afterEach, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import reactPlugin from "@vitejs/plugin-react"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://extension.test/"
})
for (const name of ["window", "document", "navigator", "HTMLElement", "MutationObserver"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Hold decorative images indefinitely to check that controls do not wait for them.
globalThis.Image = class {
  set src(value) {
    this.url = value
  }
}

const listeners = new Set()
let local, handlers, readOverride
const messages = []
const channel = {
  user_id: "1",
  user_login: "channel1",
  user_name: "Channel One",
  isLive: true,
  profile_image_url: "https://static-cdn.jtvnw.net/1.png",
  game_name: "Test Game",
  viewer_count: 20
}
function changeStorage(values, area = "local") {
  const changes = Object.fromEntries(
    Object.entries(values).map(([key, newValue]) => [key, { oldValue: local[key], newValue }])
  )
  if (area === "local") Object.assign(local, values)
  for (const listener of listeners) listener(changes, area)
}
globalThis.browser = {
  runtime: {
    id: "ui-tests",
    async sendMessage(message) {
      messages.push(message)
      assert.ok(handlers[message.type], `Unexpected message: ${message.type}`)
      return handlers[message.type](message)
    }
  },
  storage: {
    local: {
      async get(key) {
        return readOverride ? readOverride(key) : { [key]: local[key] }
      },
      async set(values) {
        changeStorage(values)
      }
    },
    onChanged: {
      addListener(listener) {
        listeners.add(listener)
      },
      removeListener(listener) {
        listeners.delete(listener)
      }
    }
  }
}

const root = fileURLToPath(new URL("../", import.meta.url))
process.env.NODE_ENV = "test"
const bundles = await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: "silent",
  plugins: [reactPlugin()],
  build: {
    write: false,
    minify: false,
    target: "esnext",
    lib: { entry: `${root}/tests/fixtures/ui-entry.jsx`, formats: ["es"] },
    rollupOptions: {
      external: (id) => /^react($|\/)|^react-dom($|\/)/.test(id),
      output: { paths: (id) => import.meta.resolve(id) }
    }
  }
})
const code = bundles[0].output.find((file) => file.type === "chunk").code
const {
  App,
  LoginPage,
  SettingsPage,
  NotificationsPage,
  ThemesPage,
  TwitchCard,
  I18nProvider,
  useStoredValue,
  asBoolean
} = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
const { createElement } = await import("react")
const { render, screen, waitFor, act, cleanup } = await import("@testing-library/react")
const { default: userEvent } = await import("@testing-library/user-event")
const mount = (Component, props = {}) =>
  render(createElement(I18nProvider, null, createElement(Component, props)))
const deferred = () => {
  let resolve
  const promise = new Promise((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

beforeEach(() => {
  local = {
    language: "en",
    theme: "default",
    rememberSession: true,
    pollIntervalMinutes: 3,
    favoritesFirst: false,
    notification_streamers: ["1"],
    twitch_channels_cache: { data: { live: [channel], offline: [] }, ts: Date.now() }
  }
  messages.length = 0
  readOverride = null
  handlers = {
    SESSION_RESTORE: async () => ({ authenticated: true }),
    SESSION_LOGOUT: async () => ({ ok: true }),
    LOAD_CHANNELS: async () => ({
      channels: local.twitch_channels_cache.data,
      updatedAt: Date.now()
    }),
    GET_PROFILE: async () => ({
      profile: {
        id: "42",
        display_name: "Tester",
        login: "tester",
        profile_image_url: "https://static-cdn.jtvnw.net/tester.png"
      }
    }),
    SET_REMEMBER_SESSION: async ({ enabled }) => {
      changeStorage({ rememberSession: enabled })
      return { rememberSession: enabled }
    },
    REMOVE_NOTIFICATION: async ({ broadcasterId }) => {
      changeStorage({
        notification_streamers: local.notification_streamers.filter((id) => id !== broadcasterId)
      })
      return { active: false }
    },
    REMOVE_FAVORITE: async ({ broadcasterId }) => {
      changeStorage({
        notification_streamers: local.notification_streamers.filter((id) => id !== broadcasterId)
      })
      return { active: false }
    }
  }
})
afterEach(() => {
  cleanup()
  assert.equal(listeners.size, 0, "Unmounting removes storage listeners")
})

test("a temporary session validation error offers retry and does not show a false login", async () => {
  handlers.SESSION_RESTORE = async () => ({ error: "Token validation failed: 503" })
  mount(App)
  assert.ok(await screen.findByRole("alert"))
  assert.equal(screen.queryByRole("button", { name: "Sign in" }), null)
  handlers.SESSION_RESTORE = async () => ({ authenticated: true })
  await userEvent.click(screen.getByRole("button", { name: "Retry" }))
  assert.ok(await screen.findByRole("button", { name: "Settings" }))
  assert.equal(messages.filter(({ type }) => type === "SESSION_RESTORE").length, 2)
})

test("a stale restore failure cannot override a newer session storage event", async () => {
  const pending = deferred()
  handlers.SESSION_RESTORE = () => pending.promise
  mount(App)
  await act(async () => {
    changeStorage({ twitch_access_token: "new-session" }, "session")
  })
  assert.ok(await screen.findByRole("button", { name: "Settings" }))
  await act(async () => {
    pending.resolve({ error: "Old token was revoked", code: "AUTH_REQUIRED" })
  })
  assert.equal(screen.queryByRole("button", { name: "Sign in" }), null)
  assert.equal(screen.queryByRole("alert"), null)
})

test("settings remain usable while the profile request is pending", async () => {
  const pending = deferred()
  handlers.GET_PROFILE = () => pending.promise
  let signedOut = false
  mount(SettingsPage, {
    onLogout() {
      signedOut = true
    },
    showOffline: false
  })
  const remember = await screen.findByRole("switch", { name: "Remember session" })
  await waitFor(() => assert.equal(remember.disabled, false))
  await userEvent.click(remember)
  await waitFor(() => assert.equal(remember.getAttribute("aria-checked"), "false"))
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }))
  assert.equal(signedOut, true)
  assert.equal(screen.queryByText("Tester"), null)
})

test("a profile image that never loads does not block account information or preferences", async () => {
  mount(SettingsPage, { showOffline: false })
  assert.ok(await screen.findByText("Tester"))
  const remember = screen.getByRole("switch", { name: "Remember session" })
  await waitFor(() => assert.equal(remember.disabled, false))
  assert.equal(screen.queryByText("Could not load the profile."), null)
})

test("favorite rows reflect cache and star changes from another panel", async () => {
  mount(NotificationsPage)
  assert.ok(await screen.findByText("Test Game"))
  await act(async () => {
    changeStorage({
      twitch_channels_cache: {
        data: { live: [], offline: [{ ...channel, isLive: false }] },
        ts: Date.now()
      }
    })
  })
  assert.equal(screen.queryByText("Test Game"), null)
  await act(async () => {
    changeStorage({ notification_streamers: [] })
  })
  assert.ok(screen.getByText("You don't have any favorite channels saved."))
  await act(async () => {
    changeStorage({ notification_streamers: ["1"] })
  })
  assert.ok(screen.getByRole("button", { name: "Remove Channel One from favorites" }))
})

test("an unfollowed channel preference remains visible and removable", async () => {
  local.notification_streamers = ["999"]
  mount(NotificationsPage)
  assert.ok(await screen.findByText("Channel 999"))
  await userEvent.click(screen.getByRole("button", { name: "Remove Channel 999 from favorites" }))
  assert.ok(await screen.findByText("You don't have any favorite channels saved."))
  assert.deepEqual(local.notification_streamers, [])
})

test("keyboard users can open a channel and toggle its star independently", async () => {
  const opened = [],
    toggled = []
  mount(TwitchCard, {
    channel,
    isLive: true,
    onClick(login) {
      opened.push(login)
    },
    onToggleFavorite(id) {
      toggled.push(id)
    }
  })
  const user = userEvent.setup()
  await user.tab()
  assert.equal(
    dom.window.document.activeElement,
    screen.getByRole("link", { name: "Open Channel One's channel" })
  )
  await user.keyboard("{Enter}")
  assert.deepEqual(opened, ["channel1"])
  await user.tab()
  assert.equal(
    dom.window.document.activeElement,
    screen.getByRole("button", { name: "Add to favorites: Channel One" })
  )
  await user.keyboard(" ")
  assert.deepEqual(toggled, ["1"])
  assert.deepEqual(opened, ["channel1"])
})

test("clicking the channel card link opens the channel while clicking the star only toggles favorites", async () => {
  const opened = [],
    toggled = []
  mount(TwitchCard, {
    channel,
    isLive: true,
    onClick(login) {
      opened.push(login)
    },
    onToggleFavorite(id) {
      toggled.push(id)
    }
  })
  const channelLink = screen.getByRole("link", { name: "Open Channel One's channel" })
  const starButton = screen.getByRole("button", { name: "Add to favorites: Channel One" })

  await userEvent.click(channelLink)
  assert.deepEqual(opened, ["channel1"])
  assert.deepEqual(toggled, [])

  await userEvent.click(starButton)
  assert.deepEqual(toggled, ["1"])
  assert.deepEqual(opened, ["channel1"])
})

test("late initial preference reads cannot overwrite a newer storage change", async () => {
  const pending = deferred()
  readOverride = (key) => (key === "showOffline" ? pending.promise : { [key]: local[key] })
  function Probe() {
    const { value } = useStoredValue("showOffline", false, asBoolean)
    return createElement("output", null, String(value))
  }
  mount(Probe)
  await act(async () => {
    changeStorage({ showOffline: true })
  })
  assert.ok(screen.getByText("true"))
  await act(async () => {
    pending.resolve({ showOffline: false })
  })
  assert.ok(screen.getByText("true"))
})

test("preferences and language react to changes from another panel", async () => {
  mount(SettingsPage, { showOffline: false })
  const interval = await screen.findByRole("combobox", { name: /Refresh every/ })
  await waitFor(() => assert.equal(interval.disabled, false))
  assert.ok(screen.getByText("Default"))
  await act(async () => {
    changeStorage({
      pollIntervalMinutes: 15,
      favoritesFirst: true,
      rememberSession: false,
      theme: "gx"
    })
  })
  assert.equal(interval.value, "15")
  assert.ok(screen.getByText("GX"))
  assert.equal(
    screen.getByRole("switch", { name: "Live favorites first" }).getAttribute("aria-checked"),
    "true"
  )
  assert.equal(
    screen.getByRole("switch", { name: "Remember session" }).getAttribute("aria-checked"),
    "false"
  )
  await act(async () => {
    changeStorage({ language: "es" })
  })
  assert.ok(screen.getByRole("switch", { name: "Recordar sesión" }))
  assert.equal(dom.window.document.documentElement.lang, "es")
})

test("changing theme updates storage", async () => {
  mount(ThemesPage)
  const gxCard = await screen.findByRole("radio", { name: /GX/i })
  await userEvent.click(gxCard)
  assert.equal(local.theme, "gx")
})

test("settings profile renders cached avatar and followers, and does not render account type or creation date", async () => {
  mount(SettingsPage, { showOffline: false })
  assert.ok(await screen.findByText("Tester"))
  const img = screen.getByAltText("Tester")
  assert.ok(img)
  assert.equal(img.src, "https://static-cdn.jtvnw.net/tester.png")
  assert.ok(screen.getByText("Followers"))
  assert.equal(screen.queryByText("Type"), null)
  assert.equal(screen.queryByText("Tipo"), null)
  assert.equal(screen.queryByText("Created"), null)
  assert.equal(screen.queryByText("Creada"), null)
  assert.equal(screen.queryByText("Partner"), null)
  assert.equal(screen.queryByText("Affiliate"), null)
  assert.equal(screen.queryByText("Standard"), null)
})

test("settings profile uses cached profile instantly without showing a loading spinner", async () => {
  local.twitch_user_profile_cache = {
    profile: {
      id: "99",
      display_name: "CachedUser",
      login: "cacheduser",
      profile_image_url: "https://static-cdn.jtvnw.net/cached.png",
      followers: 1234
    },
    ts: Date.now()
  }
  const pending = deferred()
  handlers.GET_PROFILE = () => pending.promise

  mount(SettingsPage, { showOffline: false })
  assert.ok(await screen.findByText("CachedUser"))
  const img = screen.getByAltText("CachedUser")
  assert.equal(img.src, "https://static-cdn.jtvnw.net/cached.png")
  assert.ok(screen.getByText("1234"))
  assert.equal(screen.queryByLabelText("Loading channels..."), null)
})

test("favorite live channels appear in a dedicated Favorites section and are excluded from regular live list", async () => {
  const channel2 = {
    user_id: "2",
    user_login: "channel2",
    user_name: "Channel Two",
    isLive: true,
    profile_image_url: "https://static-cdn.jtvnw.net/2.png",
    game_name: "Game Two",
    viewer_count: 50
  }
  local.twitch_channels_cache = {
    data: { live: [channel, channel2], offline: [] },
    ts: Date.now()
  }
  local.notification_streamers = ["1"]

  mount(App)
  assert.ok(await screen.findByText("Favorites"))
  const favoritesSection = dom.window.document.querySelector(".main-favorites-section")
  assert.ok(favoritesSection)
  assert.ok(favoritesSection.textContent.includes("Channel One"))
  assert.ok(!favoritesSection.textContent.includes("Channel Two"))

  const liveSection = dom.window.document.querySelector(".main-live-section")
  assert.ok(liveSection)
  assert.ok(liveSection.textContent.includes("Channel Two"))
  assert.ok(!liveSection.textContent.includes("Channel One"))

  await act(async () => {
    changeStorage({ notification_streamers: [] })
  })
  assert.equal(screen.queryByText("Favorites"), null)
  const fullLiveSection = dom.window.document.querySelector(".main-live-section")
  assert.ok(fullLiveSection.textContent.includes("Channel One"))
  assert.ok(fullLiveSection.textContent.includes("Channel Two"))

  await act(async () => {
    changeStorage({ notification_streamers: ["1", "2"] })
  })
  assert.ok(screen.getByText("Favorites"))
  assert.equal(screen.queryByText("Live"), null)
})

test("login page renders requested tagline, button text and link to ThelouisXD Twitch channel", async () => {
  mount(LoginPage, { onLogin: () => {} })
  assert.ok(screen.getByText("Quieres ver quien esta en twitch sin usar twitch /ᐠ • ˕ •マ ?"))
  const button = screen.getByRole("button", { name: "iniciar sesion en twitch" })
  assert.ok(button)

  const link = screen.getByRole("link", { name: "ThelouisXD" })
  assert.ok(link)
  assert.equal(link.getAttribute("href"), "https://www.twitch.tv/thelouisxd")
  assert.equal(link.getAttribute("target"), "_blank")
  assert.ok(link.parentElement.textContent.includes("hecho con ❤︎ por ThelouisXD"))
})

test("settings profile updates seamlessly in background when cache changes without showing a spinner", async () => {
  local.twitch_user_profile_cache = {
    profile: {
      id: "99",
      display_name: "CachedUser",
      login: "cacheduser",
      profile_image_url: "https://static-cdn.jtvnw.net/cached.png",
      avatar_data: "data:image/png;base64,AAA",
      followers: 100
    },
    ts: Date.now()
  }
  const pending = deferred()
  handlers.GET_PROFILE = () => pending.promise

  mount(SettingsPage, { showOffline: false })
  assert.ok(await screen.findByText("CachedUser"))
  const img = screen.getByAltText("CachedUser")
  assert.equal(img.src, "data:image/png;base64,AAA")
  assert.ok(screen.getByText("100"))
  assert.equal(screen.queryByRole("status"), null)

  await act(async () => {
    changeStorage({
      twitch_user_profile_cache: {
        profile: {
          id: "99",
          display_name: "UpdatedUser",
          login: "updateduser",
          profile_image_url: "https://static-cdn.jtvnw.net/updated.png",
          avatar_data: "data:image/png;base64,BBB",
          followers: 5000
        },
        ts: Date.now()
      }
    })
  })

  assert.ok(screen.getByText("UpdatedUser"))
  const updatedImg = screen.getByAltText("UpdatedUser")
  assert.equal(updatedImg.src, "data:image/png;base64,BBB")
  assert.ok(screen.getByText("5000"))
  assert.equal(screen.queryByRole("status"), null)
})
