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
  SettingsPage,
  NotificationsPage,
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

test("notification rows reflect cache and bell changes from another panel", async () => {
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
  assert.ok(screen.getByText("You don't have any streamers with notifications enabled."))
  await act(async () => {
    changeStorage({ notification_streamers: ["1"] })
  })
  assert.ok(screen.getByRole("button", { name: "Disable notifications for Channel One" }))
})

test("an unfollowed channel preference remains visible and removable", async () => {
  local.notification_streamers = ["999"]
  mount(NotificationsPage)
  assert.ok(await screen.findByText("Channel 999"))
  await userEvent.click(
    screen.getByRole("button", { name: "Disable notifications for Channel 999" })
  )
  assert.ok(await screen.findByText("You don't have any streamers with notifications enabled."))
  assert.deepEqual(local.notification_streamers, [])
})

test("keyboard users can open a channel and toggle its bell independently", async () => {
  const opened = [],
    toggled = []
  mount(TwitchCard, {
    channel,
    isLive: true,
    onClick(login) {
      opened.push(login)
    },
    onToggleNotify(id) {
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
    screen.getByRole("button", { name: "Enable notification: Channel One" })
  )
  await user.keyboard(" ")
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
  const themeSelect = screen.getByRole("combobox", { name: /Theme/ })
  await act(async () => {
    changeStorage({
      pollIntervalMinutes: 15,
      favoritesFirst: true,
      rememberSession: false,
      theme: "gx"
    })
  })
  assert.equal(interval.value, "15")
  assert.equal(themeSelect.value, "gx")
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
  mount(SettingsPage, { showOffline: false })
  const themeSelect = await screen.findByRole("combobox", { name: /Theme/ })
  await userEvent.selectOptions(themeSelect, "gx")
  assert.equal(local.theme, "gx")
})
