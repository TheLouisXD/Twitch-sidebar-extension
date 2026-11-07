import { localGet, localSet, sendMessage } from "./platform.js"
import {
  POLL_INTERVAL_OPTIONS,
  THEME_OPTIONS,
  ACCENT_OPTIONS,
  POLL_INTERVAL_KEY,
  REMEMBER_SESSION_KEY,
  THEME_KEY,
  ACCENT_KEY,
  getPreferences
} from "./preferences.js"
import { NOTIFICATIONS_KEY, getNotificationStreamers } from "./cache.js"

export const APP_SIGNATURE = "twitch-live-sidebar"
export const BACKUP_VERSION = 1
export const MAX_FAVORITES = 500

const padZero = (n) => String(n).padStart(2, "0")

export function formatBackupFilename(date = new Date()) {
  const year = date.getFullYear()
  const month = padZero(date.getMonth() + 1)
  const day = padZero(date.getDate())
  const hours = padZero(date.getHours())
  const minutes = padZero(date.getMinutes())
  const seconds = padZero(date.getSeconds())
  return `twitch_live_sidebar_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`
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
      rememberSession: preferences.rememberSession !== false,
      theme: preferences.theme,
      accentColor: preferences.accentColor,
      language: language === "es" ? "es" : "en"
    },
    favorites: [...favoritesSet]
  }
}

export function validateBackupData(input) {
  let parsed = input
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input)
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

  const rawPrefs =
    parsed.preferences &&
    typeof parsed.preferences === "object" &&
    !Array.isArray(parsed.preferences)
      ? parsed.preferences
      : {}

  const cleanPrefs = {}

  if (POLL_INTERVAL_OPTIONS.includes(rawPrefs.pollIntervalMinutes)) {
    cleanPrefs.pollIntervalMinutes = rawPrefs.pollIntervalMinutes
  }
  if (typeof rawPrefs.showOffline === "boolean") {
    cleanPrefs.showOffline = rawPrefs.showOffline
  }
  if (typeof rawPrefs.rememberSession === "boolean") {
    cleanPrefs.rememberSession = rawPrefs.rememberSession
  }
  if (THEME_OPTIONS.includes(rawPrefs.theme)) {
    cleanPrefs.theme = rawPrefs.theme
  }
  if (ACCENT_OPTIONS.includes(rawPrefs.accentColor) || rawPrefs.accentColor === null) {
    cleanPrefs.accentColor = rawPrefs.accentColor
  }
  if (rawPrefs.language === "es" || rawPrefs.language === "en") {
    cleanPrefs.language = rawPrefs.language
  }

  const rawFavs = Array.isArray(parsed.favorites) ? parsed.favorites : []
  const cleanFavs = []
  const seen = new Set()

  for (const id of rawFavs) {
    if (typeof id === "string" && /^\d+$/.test(id) && !seen.has(id)) {
      seen.add(id)
      cleanFavs.push(id)
      if (cleanFavs.length >= MAX_FAVORITES) break
    }
  }

  return {
    valid: true,
    data: {
      preferences: cleanPrefs,
      favorites: cleanFavs
    }
  }
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
    URL.revokeObjectURL(url)
    return { success: true, filename }
  }

  return { success: false, error: "settings.backupError" }
}

export async function applyBackupData(sanitizedData) {
  const { preferences, favorites } = sanitizedData
  const storageUpdate = {}

  if (preferences.pollIntervalMinutes !== undefined) {
    storageUpdate[POLL_INTERVAL_KEY] = preferences.pollIntervalMinutes
    await sendMessage({
      type: "SET_POLL_INTERVAL",
      minutes: preferences.pollIntervalMinutes
    }).catch(() => {})
  }
  if (preferences.rememberSession !== undefined) {
    storageUpdate[REMEMBER_SESSION_KEY] = preferences.rememberSession
    await sendMessage({ type: "SET_REMEMBER_SESSION", enabled: preferences.rememberSession }).catch(
      () => {}
    )
  }
  if (preferences.theme !== undefined) {
    storageUpdate[THEME_KEY] = preferences.theme
  }
  if (preferences.accentColor !== undefined) {
    storageUpdate[ACCENT_KEY] = preferences.accentColor
  }
  if (preferences.showOffline !== undefined) {
    storageUpdate.showOffline = preferences.showOffline
  }
  if (preferences.language !== undefined) {
    storageUpdate.language = preferences.language
  }

  if (Object.keys(storageUpdate).length > 0) {
    await localSet(storageUpdate)
  }

  if (Array.isArray(favorites)) {
    await localSet({ [NOTIFICATIONS_KEY]: favorites })
  }

  return true
}
