import { localGet, localRemove, localSet, sendMessage } from "./platform.js"
import {
  POLL_INTERVAL_OPTIONS,
  THEME_OPTIONS,
  ACCENT_OPTIONS,
  POLL_INTERVAL_KEY,
  REMEMBER_SESSION_KEY,
  THEME_KEY,
  ACCENT_KEY,
  normalizePollInterval,
  getPreferences
} from "./preferences.js"
import { MAX_FAVORITES, decodeNotificationIds, getNotificationStreamers } from "./cache.js"

export { MAX_FAVORITES }
export const APP_SIGNATURE = "twitch-live-sidebar"
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 256 * 1024

export function formatBackupFilename(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", "_")
    .replaceAll(":", "-")
  return `twitch_live_sidebar_${local}.json`
}

export async function createBackupPayload() {
  const preferences = await getPreferences()
  const { showOffline, language } = await localGet(["showOffline", "language"])
  const favoritesSet = await getNotificationStreamers()

  return {
    app: APP_SIGNATURE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: {
      pollIntervalMinutes: preferences.pollIntervalMinutes,
      showOffline: showOffline === true,
      rememberSession: preferences.rememberSession,
      theme: preferences.theme,
      accentColor: preferences.accentColor,
      language: language === "es" ? "es" : "en"
    },
    favorites: [...favoritesSet].slice(0, MAX_FAVORITES)
  }
}

function sanitizePreferences(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  const clean = {}

  if (POLL_INTERVAL_OPTIONS.includes(source.pollIntervalMinutes)) {
    clean.pollIntervalMinutes = source.pollIntervalMinutes
  }
  if (typeof source.showOffline === "boolean") {
    clean.showOffline = source.showOffline
  }
  if (typeof source.rememberSession === "boolean") {
    clean.rememberSession = source.rememberSession
  }
  if (THEME_OPTIONS.includes(source.theme)) {
    clean.theme = source.theme
  }
  if (ACCENT_OPTIONS.includes(source.accentColor) || source.accentColor === null) {
    clean.accentColor = source.accentColor
  }
  if (source.language === "es" || source.language === "en") {
    clean.language = source.language
  }

  return clean
}

export function validateBackupData(input) {
  let parsed = input
  if (typeof input === "string") {
    if (input.length > MAX_BACKUP_BYTES) {
      return { valid: false, error: "settings.backupInvalidFile" }
    }
    try {
      parsed = JSON.parse(input.replace(/^\uFEFF/, ""))
    } catch {
      return { valid: false, error: "settings.backupInvalidFile" }
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, error: "settings.backupInvalidFile" }
  }

  if (parsed.app !== APP_SIGNATURE || parsed.version !== BACKUP_VERSION) {
    return { valid: false, error: "settings.backupInvalidFile" }
  }

  if (parsed.favorites !== undefined && !Array.isArray(parsed.favorites)) {
    return { valid: false, error: "settings.backupInvalidFile" }
  }

  const data = { preferences: sanitizePreferences(parsed.preferences) }
  if (parsed.favorites !== undefined) {
    data.favorites = [...new Set(decodeNotificationIds(parsed.favorites))].slice(0, MAX_FAVORITES)
  }

  return { valid: true, data }
}

export async function exportBackupFile(payload) {
  const filename = formatBackupFilename()
  const content = JSON.stringify(payload, null, 2)

  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "JSON Backup",
            accept: { "application/json": [".json"] }
          }
        ]
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { success: true, filename }
    } catch (err) {
      if (err?.name === "AbortError") {
        return { success: false, cancelled: true }
      }
      // If permission or feature restricted, continue to fallback below
    }
  }

  if (typeof document !== "undefined") {
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    const timer = setTimeout(() => URL.revokeObjectURL(url), 1000)
    timer?.unref?.()
    return { success: true, filename }
  }

  return { success: false, error: "settings.backupError" }
}

export async function applyBackupData(sanitizedData) {
  const input = sanitizedData && typeof sanitizedData === "object" ? sanitizedData : {}
  const preferences = sanitizePreferences(input.preferences)
  const hasFavorites = Array.isArray(input.favorites)
  const favorites = hasFavorites
    ? [...new Set(decodeNotificationIds(input.favorites))].slice(0, MAX_FAVORITES)
    : undefined

  const localKeys = [
    THEME_KEY,
    ACCENT_KEY,
    "showOffline",
    "language",
    ...(preferences.pollIntervalMinutes !== undefined ? [POLL_INTERVAL_KEY] : []),
    ...(preferences.rememberSession !== undefined ? [REMEMBER_SESSION_KEY] : [])
  ]
  const previousLocal = await localGet(localKeys)
  const prevRememberSession = previousLocal[REMEMBER_SESSION_KEY] !== false

  const storageUpdate = {}
  if (preferences.theme !== undefined) storageUpdate[THEME_KEY] = preferences.theme
  if (preferences.accentColor !== undefined) storageUpdate[ACCENT_KEY] = preferences.accentColor
  if (preferences.showOffline !== undefined) storageUpdate.showOffline = preferences.showOffline
  if (preferences.language !== undefined) storageUpdate.language = preferences.language

  let rememberChanged = false
  let pollChanged = false
  let localChanged = false

  try {
    if (preferences.rememberSession !== undefined) {
      await sendMessage({ type: "SET_REMEMBER_SESSION", enabled: preferences.rememberSession })
      rememberChanged = true
    }
    if (preferences.pollIntervalMinutes !== undefined) {
      await sendMessage({
        type: "SET_POLL_INTERVAL",
        minutes: preferences.pollIntervalMinutes
      })
      pollChanged = true
    }
    if (Object.keys(storageUpdate).length > 0) {
      await localSet(storageUpdate)
      localChanged = true
    }
    if (hasFavorites) {
      await sendMessage({ type: "SET_NOTIFICATIONS", ids: favorites })
    }
  } catch (error) {
    // Best-effort rollback so a partial failure does not leave mixed settings behind.
    const rollbacks = []
    if (localChanged) {
      const restoreLocal = {}
      const removeKeys = []
      for (const key of Object.keys(storageUpdate)) {
        if (previousLocal[key] === undefined) removeKeys.push(key)
        else restoreLocal[key] = previousLocal[key]
      }
      if (Object.keys(restoreLocal).length > 0) rollbacks.push(localSet(restoreLocal))
      if (removeKeys.length > 0) rollbacks.push(localRemove(removeKeys))
    }
    if (pollChanged) {
      rollbacks.push(
        sendMessage({
          type: "SET_POLL_INTERVAL",
          minutes: normalizePollInterval(previousLocal[POLL_INTERVAL_KEY])
        })
      )
    }
    if (rememberChanged) {
      rollbacks.push(sendMessage({ type: "SET_REMEMBER_SESSION", enabled: prevRememberSession }))
    }
    await Promise.allSettled(rollbacks)
    throw error
  }

  return true
}
