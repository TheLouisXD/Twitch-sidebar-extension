import test from "node:test"
import assert from "node:assert/strict"

const mockStorage = {}
const mockSentMessages = []
let failMessageType = null

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
        Object.assign(mockStorage, items)
      }
    }
  }
}

const {
  APP_SIGNATURE,
  BACKUP_VERSION,
  MAX_FAVORITES,
  formatBackupFilename,
  validateBackupData,
  exportBackupFile,
  applyBackupData,
  createBackupPayload
} = await import("../src/backup.js")

test("formatBackupFilename formats filename with extension name and timestamp", () => {
  const fixedDate = new Date(2026, 10, 3, 16, 30, 45) // Note: month 10 is November in JS 0-indexed Date
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

  // Stringified JSON parsing
  const fromString = validateBackupData(JSON.stringify(validPayload))
  assert.equal(fromString.valid, true)
  assert.deepEqual(fromString.data, result.data)
})

test("validateBackupData rejects invalid JSON and non-objects", () => {
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

test("validateBackupData filters out injection attempts and unwhitelisted values", () => {
  const maliciousPayload = {
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    preferences: {
      pollIntervalMinutes: 9999, // not in POLL_INTERVAL_OPTIONS
      showOffline: "yes", // not boolean
      rememberSession: { $gt: "" }, // injection attempt
      theme: "<script>alert(1)</script>", // not in THEME_OPTIONS
      accentColor: "invalid_color", // not in ACCENT_OPTIONS
      language: "fr", // not 'es' | 'en'
      maliciousField: "rm -rf /", // unknown property
      __proto__: { isAdmin: true }
    },
    favorites: [
      "123456",
      "789012",
      "123456", // duplicate
      "-45", // negative number
      "123; DROP TABLE", // SQL injection attempt
      "<script>alert(1)</script>", // XSS attempt
      12345, // not string
      null,
      undefined
    ]
  }

  const result = validateBackupData(maliciousPayload)
  assert.equal(result.valid, true)
  assert.deepEqual(result.data.preferences, {})
  assert.deepEqual(result.data.favorites, ["123456", "789012"])
  assert.equal(Object.prototype.isAdmin, undefined)
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

test("applyBackupData saves valid preferences and favorites to storage and background", async () => {
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
})

test("applyBackupData rejects without overwriting rememberSession if migration fails", async () => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  mockStorage.rememberSession = true
  failMessageType = "SET_REMEMBER_SESSION"
  try {
    await assert.rejects(
      applyBackupData({
        preferences: { rememberSession: false, theme: "gx" },
        favorites: ["111"]
      }),
      /Migration failed/
    )
    assert.equal(mockStorage.rememberSession, true)
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
