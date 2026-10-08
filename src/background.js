import { CLIENT_ID, SCOPES } from "./config.js"
import { AuthError, requestTokens } from "./auth.js"
import { extension, callExtension, isFirefox, localGet, localSet, openChannel } from "./platform.js"
import {
  CHANNELS_KEY, NOTIFICATIONS_KEY, PREV_LIVE_KEY, clearAllCache,
  getCachedChannels, getNotificationStreamers, setCachedChannels, setCachedProfiles,
} from "./cache.js"
import {
  getSessionRevision, invalidateSession, assertSession, restoreSession,
  saveTokens, clearTokens, withSession, waitForSessionTasks,
} from "./session.js"
import { fetchAllFollowed, fetchUser, fetchTwitch } from "./twitch.js"
import { randomState, parseAuthRedirect } from "./oauth.js"
import { getPreferences, POLL_INTERVAL_KEY, FAVORITES_FIRST_KEY, POLL_INTERVAL_OPTIONS } from "./preferences.js"

const ALARM_NAME = "twitch_poll_streams"
let pollTask
let authTask
let logoutTask
let notificationQueue = Promise.resolve()
let alarmQueue = Promise.resolve()
let badgeQueue = Promise.resolve()

function report(error) {
  console.error("[Twitch Sidebar]", error.message)
}

function ensureAlarm() {
  const task = alarmQueue.then(async () => {
    const { pollIntervalMinutes } = await getPreferences()
    const alarm = await callExtension("alarms.get", ALARM_NAME)
    if (alarm?.periodInMinutes !== pollIntervalMinutes) {
      await callExtension("alarms.create", ALARM_NAME, { periodInMinutes: pollIntervalMinutes })
    }
  })
  alarmQueue = task.catch(() => {})
  return task
}

function setBadge(count) {
  return callExtension("action.setBadgeText", { text: count > 0 ? String(count) : "" })
}

function syncBadgeFromCache() {
  const task = badgeQueue.then(async () => {
    const cached = await getCachedChannels()
    await setBadge(cached?.data.live.length ?? 0)
  })
  badgeQueue = task.catch(() => {})
  return task
}

export function notificationOptions(stream, language) {
  const spanish = language === "es"
  return {
    type: "basic",
    iconUrl: extension.runtime.getURL("icons/icon128.png"),
    title: spanish ? `🔴 ¡${stream.user_name} está en vivo!` : `🔴 ${stream.user_name} is live!`,
    message: stream.game_name
      ? `${spanish ? "Jugando" : "Playing"}: ${stream.game_name}`
      : (spanish ? "En vivo ahora" : "Live now"),
    ...(isFirefox ? {} : { priority: 2, silent: true }),
  }
}

function pollStreams() {
  if (pollTask) return pollTask
  const expected = getSessionRevision()
  pollTask = (async () => {
    const token = await restoreSession()
    assertSession(expected)
    if (!token) return null
    const { data, profileMap, profilesChanged } = await withSession(fetchAllFollowed)
    assertSession(expected)
    if (profilesChanged) await setCachedProfiles(profileMap)
    assertSession(expected)
    await setCachedChannels(data)
    assertSession(expected)
    await syncBadgeFromCache()
    const { [PREV_LIVE_KEY]: previous, language } = await localGet([PREV_LIVE_KEY, "language"])
    const watched = await getNotificationStreamers()
    assertSession(expected)
    // First successful poll establishes a baseline. Keep it current even when
    // no bells are enabled, so enabling one does not notify an existing stream.
    if (Array.isArray(previous)) {
      const previousIds = new Set(previous)
      for (const stream of data.live) {
        assertSession(expected)
        if (watched.has(stream.user_id) && !previousIds.has(stream.user_id)) {
          await callExtension("notifications.create", `twitch-live-${stream.user_id}`,
            notificationOptions(stream, language)).catch(report)
        }
      }
    }
    assertSession(expected)
    await localSet({ [PREV_LIVE_KEY]: data.live.map((stream) => stream.user_id) })
    return data
  })().finally(() => { pollTask = null })
  return pollTask
}

function signOut() {
  if (logoutTask) return logoutTask
  invalidateSession()
  logoutTask = (async () => {
    // Invalidate immediately, then finish pending writes before clearing data.
    await Promise.allSettled([pollTask, notificationQueue, waitForSessionTasks()].filter(Boolean))
    await clearTokens()
    await clearAllCache()
    await syncBadgeFromCache()
    return { ok: true }
  })().finally(() => { logoutTask = null })
  return logoutTask
}

function authenticate() {
  if (authTask) return authTask
  invalidateSession()
  const expected = getSessionRevision()
  authTask = (async () => {
    const redirectUri = extension.identity.getRedirectURL()
    const state = randomState()
    const params = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
      scope: SCOPES, state, force_verify: "false",
    })
    const redirect = await callExtension("identity.launchWebAuthFlow", {
      url: `https://id.twitch.tv/oauth2/authorize?${params}`, interactive: true,
    })
    assertSession(expected)
    const code = parseAuthRedirect(redirect, redirectUri, state)
    const tokens = await requestTokens("exchange", {
      code, redirect_uri: redirectUri,
      // Compatibility with the deployed Worker, which requires but ignores
      // this field. Twitch's documented code grant uses the server secret.
      code_verifier: state,
    })
    assertSession(expected)
    await Promise.allSettled([pollTask, waitForSessionTasks()].filter(Boolean))
    assertSession(expected)
    await clearAllCache()
    const accessToken = await saveTokens(tokens, expected)
    return { access_token: accessToken }
  })().finally(() => { authTask = null })
  return authTask
}

function changeStreamerPreference(key, id, remove = false) {
  if (typeof id !== "string" || !/^\d+$/.test(id)) throw new Error("Invalid broadcaster ID")
  const expected = getSessionRevision()
  const task = notificationQueue.then(async () => {
    const { [key]: stored } = await localGet(key)
    const ids = new Set(Array.isArray(stored) ? stored : [])
    assertSession(expected)
    if (remove || ids.has(id)) ids.delete(id)
    else ids.add(id)
    await localSet({ [key]: [...ids] })
    return { active: ids.has(id) }
  })
  notificationQueue = task.catch(() => {})
  return task
}

async function getProfile() {
  return withSession(async (token) => {
    const profile = await fetchUser(token)
    try {
      const result = await fetchTwitch(token, "channels/followers",
        new URLSearchParams({ broadcaster_id: profile.id, first: "1" }))
      profile.followers = result.total
    } catch (error) {
      // Follower count is optional; do not request moderator access for it.
      if (error instanceof AuthError) throw error
    }
    return { profile }
  })
}

async function route(message) {
  if (message.type === "SESSION_LOGOUT") return signOut()
  if (logoutTask) await logoutTask
  switch (message.type) {
    case "TWITCH_AUTH": return authenticate()
    case "TWITCH_GET_REDIRECT_URL": return { redirectUrl: extension.identity.getRedirectURL() }
    case "SESSION_RESTORE": return { access_token: await restoreSession() }
    case "GET_PROFILE": return getProfile()
    case "LOAD_CHANNELS":
    case "POLL_NOW": {
      await ensureAlarm()
      // Cache is displayed instantly by the UI; always refresh on opening.
      const channels = await pollStreams()
      const cached = await getCachedChannels()
      return { channels: cached?.data ?? channels, updatedAt: cached?.ts ?? 0 }
    }
    case "SET_POLL_INTERVAL": {
      if (!POLL_INTERVAL_OPTIONS.includes(message.minutes)) throw new Error("Invalid refresh interval")
      await localSet({ [POLL_INTERVAL_KEY]: message.minutes })
      await ensureAlarm()
      return { pollIntervalMinutes: (await getPreferences()).pollIntervalMinutes }
    }
    case "SET_FAVORITES_FIRST": {
      if (typeof message.enabled !== "boolean") throw new Error("Invalid favorite sorting preference")
      await localSet({ [FAVORITES_FIRST_KEY]: message.enabled })
      return { favoritesFirst: message.enabled }
    }
    case "TOGGLE_NOTIFICATION": return changeStreamerPreference(NOTIFICATIONS_KEY, message.broadcasterId)
    case "REMOVE_NOTIFICATION": return changeStreamerPreference(NOTIFICATIONS_KEY, message.broadcasterId, true)
    default: return { error: "Unknown message" }
  }
}

// Keep a synchronous listener + true for asynchronous responses on both browsers.
extension.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== extension.runtime.id || !message || typeof message.type !== "string") return false
  route(message).then(respond).catch(async (error) => {
    if (error instanceof AuthError) await signOut().catch(report)
    respond({ error: error.message })
  })
  return true
})

extension.action.onClicked.addListener((tab) => {
  // Invoke synchronously inside the user gesture; awaiting loses that gesture.
  const operation = isFirefox
    ? callExtension("sidebarAction.toggle")
    : callExtension("sidePanel.open", { windowId: tab.windowId })
  operation.catch(report)
})

function runPoll() {
  if (logoutTask) return
  return pollStreams().catch(async (error) => {
    if (error instanceof AuthError) await signOut().catch(report)
    else report(error)
  })
}

extension.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  if (changes[POLL_INTERVAL_KEY]) ensureAlarm().catch(report)
  if (changes[CHANNELS_KEY]) syncBadgeFromCache().catch(report)
})

extension.runtime.onInstalled.addListener(() => {
  ensureAlarm().catch(report)
  runPoll()
})
extension.runtime.onStartup.addListener(() => {
  ensureAlarm().catch(report)
  runPoll()
})
extension.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) return runPoll()
})
extension.notifications.onClicked.addListener((id) => {
  if (!id.startsWith("twitch-live-")) return
  localGet(CHANNELS_KEY).then(async (result) => {
    const data = result[CHANNELS_KEY]?.data
    const channel = [...(data?.live ?? []), ...(data?.offline ?? [])]
      .find((item) => item.user_id === id.slice("twitch-live-".length))
    if (channel) await openChannel(channel.user_login)
  }).catch(report).finally(() => { callExtension("notifications.clear", id).catch(report) })
})

callExtension("action.setBadgeBackgroundColor", { color: "#9147ff" }).catch(report)
ensureAlarm().catch(report)
syncBadgeFromCache().catch(report)
