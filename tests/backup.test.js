import test from "node:test"
import assert from "node:assert/strict"

const mockStorage = {}
const mockSentMessages = []
let failMessageType = null
let failLocalSet = false

globalThis.browser = {
  runtime: {
    id: "backup-test-runner",
    sendMessage: async (msg) => {
      mockSentMessages.push(msg)
      if (msg.type === failMessageType) {
        return { error: "Migration failed" }
      }
      if (msg.type === "SET_POLL_INTERVAL") {
        mockStorage.pollIntervalMinutes = msg.minutes
      }
      if (msg.type === "SET_REMEMBER_SESSION") {
        mockStorage.rememberSession = msg.enabled
      }
      if (msg.type === "SET_NOTIFICATIONS") {
        mockStorage.notification_streamers = msg.ids
      }
      return {}
    }
  },
  storage: {
    local: {
      get: async (keys) => {
        if (Array.isArray(keys)) {
          const res = {}
          for (const k of keys) res[k] = mockStorage[k]
          return res
        }
        if (typeof keys === "string") return { [keys]: mockStorage[keys] }
        return { ...mockStorage }
      },
      set: async (items) => {
        if (failLocalSet) throw new Error("Storage write failed")
        Object.assign(mockStorage, items)
      },
      remove: async (keys) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete mockStorage[k]
      }
    }
  }
}

const {
  APP_SIGNATURE,
  BACKUP_VERSION,
  MAX_FAVORITES,
  MAX_BACKUP_BYTES,
  formatBackupFilename,
  validateBackupData,
  exportBackupFile,
  applyBackupData,
  createBackupPayload
} = await import("../src/backup.js")

test("formatBackupFilename formats filename with extension name and timestamp", () => {
  const fixedDate = new Date(2026, 10, 3, 16, 30, 45)
  const filename = formatBackupFilename(fixedDate)
  assert.equal(filename, "twitch_live_sidebar_2026-11-03_16-30-45.json")

  const defaultFilename = formatBackupFilename()
  assert.match(defaultFilename, /^twitch_live_sidebar_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/)
})

test("validateBackupData validates genuine extension backup payload", () => {
  const validPayload = {
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    exportedAt: "2026-11-03T16:30:45.000Z",
    preferences: {
      pollIntervalMinutes: 5,
      showOffline: true,
      rememberSession: false,
      theme: "gx",
      accentColor: "blue",
      language: "es"
    },
    favorites: ["123456", "789012"]
  }

  const result = validateBackupData(validPayload)
  assert.equal(result.valid, true)
  assert.deepEqual(result.data.preferences, {
    pollIntervalMinutes: 5,
    showOffline: true,
    rememberSession: false,
    theme: "gx",
    accentColor: "blue",
    language: "es"
  })
  assert.deepEqual(result.data.favorites, ["123456", "789012"])

  const fromString = validateBackupData(JSON.stringify(validPayload))
  assert.equal(fromString.valid, true)
  assert.deepEqual(fromString.data, result.data)

  const withBom = validateBackupData(`\uFEFF${JSON.stringify(validPayload)}`)
  assert.equal(withBom.valid, true)
  assert.deepEqual(withBom.data, result.data)
})

test("validateBackupData rejects invalid JSON, non-objects, and oversized payloads", () => {
  assert.deepEqual(validateBackupData("{ invalid json }"), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
  assert.deepEqual(validateBackupData(null), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
  assert.deepEqual(validateBackupData([]), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
  assert.deepEqual(validateBackupData(12345), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
  assert.deepEqual(validateBackupData("x".repeat(MAX_BACKUP_BYTES + 1)), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
})

test("validateBackupData rejects payloads from other extensions or wrong versions", () => {
  const wrongApp = {
    app: "other-extension",
    version: BACKUP_VERSION,
    preferences: {},
    favorites: []
  }
  assert.deepEqual(validateBackupData(wrongApp), {
    valid: false,
    error: "settings.backupInvalidFile"
  })

  const wrongVersion = {
    app: APP_SIGNATURE,
    version: 99,
    preferences: {},
    favorites: []
  }
  assert.deepEqual(validateBackupData(wrongVersion), {
    valid: false,
    error: "settings.backupInvalidFile"
  })
})

test("validateBackupData filters out injection attempts, prototype keys, and unwhitelisted values", () => {
  const rawJson = JSON.stringify({
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: {
      pollIntervalMinutes: 9999,
      showOffline: "yes",
      rememberSession: { $gt: "" },
      theme: "<script>alert(1)</script>",
      accentColor: "invalid_color",
      language: "fr",
      maliciousField: "rm -rf /"
    },
    favorites: [
      "123456",
      "789012",
      "123456",
      "-45",
      "123; DROP TABLE",
      "<script>alert(1)</script>",
      "9".repeat(33),
      12345,
      null
    ]
  }).replace(
    '"maliciousField":"rm -rf /"',
    '"maliciousField":"rm -rf /","__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":true}}'
  )

  const result = validateBackupData(rawJson)
  assert.equal(result.valid, true)
  assert.deepEqual(result.data.preferences, {})
  assert.deepEqual(result.data.favorites, ["123456", "789012"])
  assert.equal(Object.prototype.isAdmin, undefined)
  assert.equal(Object.prototype.polluted, undefined)
  assert.equal(Object.hasOwn(result.data.preferences, "__proto__"), false)
  assert.equal(Object.hasOwn(result.data.preferences, "constructor"), false)
})

test("validateBackupData handles null accentColor, omitted favorites, and invalid favorites types", () => {
  const withNullAccent = validateBackupData({
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: { accentColor: null }
  })
  assert.equal(withNullAccent.valid, true)
  assert.equal(withNullAccent.data.preferences.accentColor, null)
  assert.equal("favorites" in withNullAccent.data, false)

  const withInvalidFavs = validateBackupData({
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: {},
    favorites: "not-an-array"
  })
  assert.deepEqual(withInvalidFavs, {
    valid: false,
    error: "settings.backupInvalidFile"
  })
})

test("validateBackupData caps favorites at MAX_FAVORITES", () => {
  const hugeFavorites = Array.from({ length: 600 }, (_, i) => String(100000 + i))
  const payload = {
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: {},
    favorites: hugeFavorites
  }

  const result = validateBackupData(payload)
  assert.equal(result.valid, true)
  assert.equal(result.data.favorites.length, MAX_FAVORITES)
  assert.equal(result.data.favorites[0], "100000")
})

test("exportBackupFile uses window.showSaveFilePicker if present", async () => {
  let pickerCalled = false
  let writtenData = ""

  globalThis.window = {
    showSaveFilePicker: async (options) => {
      pickerCalled = true
      assert.match(options.suggestedName, /^twitch_live_sidebar_.*\.json$/)
      return {
        createWritable: async () => ({
          write: async (content) => {
            writtenData = content
          },
          close: async () => {}
        })
      }
    }
  }

  const payload = {
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: { theme: "gx" },
    favorites: ["999"]
  }

  const result = await exportBackupFile(payload)
  assert.equal(pickerCalled, true)
  assert.equal(result.success, true)
  assert.match(writtenData, /"theme": "gx"/)
})

test("exportBackupFile handles user cancellation gracefully", async () => {
  globalThis.window = {
    showSaveFilePicker: async () => {
      const err = new Error("The user aborted a request.")
      err.name = "AbortError"
      throw err
    }
  }

  const result = await exportBackupFile({ app: APP_SIGNATURE, version: BACKUP_VERSION })
  assert.equal(result.success, false)
  assert.equal(result.cancelled, true)
})

test("exportBackupFile falls back to Blob download and defers revokeObjectURL", async () => {
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  const prevCreate = URL.createObjectURL
  const prevRevoke = URL.revokeObjectURL
  const prevSetTimeout = globalThis.setTimeout

  let clicked = false
  let revokedUrl = null
  let scheduledDelay = null
  let scheduledCallback = null
  const anchor = {
    href: "",
    download: "",
    click() {
      clicked = true
      assert.equal(revokedUrl, null)
    }
  }

  globalThis.window = {}
  globalThis.document = {
    createElement: (tag) => {
      assert.equal(tag, "a")
      return anchor
    },
    body: {
      appendChild() {},
      removeChild() {}
    }
  }
  URL.createObjectURL = () => "blob:mock-backup"
  URL.revokeObjectURL = (url) => {
    revokedUrl = url
  }
  globalThis.setTimeout = (fn, ms) => {
    scheduledCallback = fn
    scheduledDelay = ms
    return { unref() {} }
  }

  try {
    const result = await exportBackupFile({ app: APP_SIGNATURE, version: BACKUP_VERSION })
    assert.equal(result.success, true)
    assert.equal(clicked, true)
    assert.equal(revokedUrl, null)
    assert.ok(scheduledDelay >= 1000)
    scheduledCallback()
    assert.equal(revokedUrl, "blob:mock-backup")
  } finally {
    globalThis.window = prevWindow
    globalThis.document = prevDocument
    URL.createObjectURL = prevCreate
    URL.revokeObjectURL = prevRevoke
    globalThis.setTimeout = prevSetTimeout
  }
})

test("applyBackupData saves valid preferences and favorites and preserves omitted favorites", async () => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  mockSentMessages.length = 0

  const sanitized = {
    preferences: {
      pollIntervalMinutes: 10,
      rememberSession: true,
      theme: "gx",
      accentColor: "red",
      showOffline: false,
      language: "es"
    },
    favorites: ["111", "222"]
  }

  await applyBackupData(sanitized)

  assert.equal(mockStorage.pollIntervalMinutes, 10)
  assert.equal(mockStorage.rememberSession, true)
  assert.equal(mockStorage.theme, "gx")
  assert.equal(mockStorage.accentColor, "red")
  assert.equal(mockStorage.showOffline, false)
  assert.equal(mockStorage.language, "es")
  assert.deepEqual(mockStorage.notification_streamers, ["111", "222"])
  assert.ok(mockSentMessages.some((m) => m.type === "SET_POLL_INTERVAL" && m.minutes === 10))
  assert.ok(mockSentMessages.some((m) => m.type === "SET_REMEMBER_SESSION" && m.enabled === true))
  assert.ok(mockSentMessages.some((m) => m.type === "SET_NOTIFICATIONS"))

  await applyBackupData({ preferences: { theme: "default" } })
  assert.equal(mockStorage.theme, "default")
  assert.deepEqual(mockStorage.notification_streamers, ["111", "222"])
})

test("applyBackupData rolls back earlier writes when a later step fails", async () => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  mockStorage.rememberSession = true
  mockStorage.pollIntervalMinutes = 3
  mockStorage.theme = "default"
  mockStorage.notification_streamers = ["999"]

  failMessageType = "SET_REMEMBER_SESSION"
  try {
    await assert.rejects(
      applyBackupData({
        preferences: { rememberSession: false, pollIntervalMinutes: 15, theme: "gx" },
        favorites: ["111"]
      }),
      /Migration failed/
    )
    assert.equal(mockStorage.rememberSession, true)
    assert.equal(mockStorage.pollIntervalMinutes, 3)
    assert.equal(mockStorage.theme, "default")
    assert.deepEqual(mockStorage.notification_streamers, ["999"])
  } finally {
    failMessageType = null
  }

  failMessageType = "SET_NOTIFICATIONS"
  try {
    await assert.rejects(
      applyBackupData({
        preferences: { rememberSession: false, pollIntervalMinutes: 15, theme: "gx" },
        favorites: ["111"]
      }),
      /Migration failed/
    )
    assert.equal(mockStorage.rememberSession, true)
    assert.equal(mockStorage.pollIntervalMinutes, 3)
    assert.equal(mockStorage.theme, "default")
    assert.deepEqual(mockStorage.notification_streamers, ["999"])
  } finally {
    failMessageType = null
  }
})

test("createBackupPayload generates complete backup with metadata, preferences, and favorites", async () => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  mockStorage.pollIntervalMinutes = 15
  mockStorage.rememberSession = false
  mockStorage.theme = "gx"
  mockStorage.accentColor = "sky"
  mockStorage.showOffline = true
  mockStorage.language = "es"
  mockStorage.notification_streamers = ["45678", "98765"]

  const payload = await createBackupPayload()
  assert.equal(payload.app, APP_SIGNATURE)
  assert.equal(payload.version, BACKUP_VERSION)
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(payload.preferences, {
    pollIntervalMinutes: 15,
    showOffline: true,
    rememberSession: false,
    theme: "gx",
    accentColor: "sky",
    language: "es"
  })
  assert.deepEqual(payload.favorites, ["45678", "98765"])
})
