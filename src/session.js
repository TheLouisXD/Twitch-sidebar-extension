import { CLIENT_ID, SCOPES } from "./config.js"
import { AuthError, requestTokens } from "./auth.js"
import {
  localGet,
  localSet,
  localRemove,
  sessionGet,
  sessionSet,
  sessionRemove
} from "./platform.js"
import { REMEMBER_SESSION_KEY } from "./preferences.js"

let revision = 0
let refreshTask
let restoreTask
const tokenWrites = new Set()
let credentialQueue = Promise.resolve()
export const getSessionRevision = () => revision
export const invalidateSession = () => {
  revision++
}

export class SessionChangedError extends Error {
  code = "SESSION_CHANGED"
}

export function assertSession(expected) {
  if (revision !== expected) throw new SessionChangedError("Session changed")
}

// Check rejected operations too: an old 401 must not sign out a newer session.
export async function guardSession(expected, operation) {
  try {
    assertSession(expected)
    const result = await operation()
    assertSession(expected)
    return result
  } catch (error) {
    assertSession(expected)
    if (error instanceof AuthError) error.sessionRevision = expected
    throw error
  }
}

function queueCredentials(expected, operation) {
  const task = credentialQueue.then(() => guardSession(expected, operation))
  credentialQueue = task.catch(() => {})
  tokenWrites.add(task)
  return task.finally(() => {
    tokenWrites.delete(task)
  })
}

export function saveTokens(tokens, expected = revision) {
  return queueCredentials(expected, async () => {
    assertSession(expected)
    const preferences = await localGet(REMEMBER_SESSION_KEY)
    if (preferences[REMEMBER_SESSION_KEY] !== false) {
      await localSet({ twitch_refresh_token: tokens.refresh_token })
      await sessionRemove("twitch_refresh_token")
    } else {
      await sessionSet({ twitch_refresh_token: tokens.refresh_token })
      await localRemove("twitch_refresh_token")
    }
    assertSession(expected)
    await sessionSet({ twitch_access_token: tokens.access_token, twitch_validated_at: 0 })
    assertSession(expected)
    return tokens.access_token
  })
}

export function setRememberSession(enabled) {
  const expected = revision
  return queueCredentials(expected, async () => {
    const [local, session] = await Promise.all([
      localGet([REMEMBER_SESSION_KEY, "twitch_refresh_token"]),
      sessionGet("twitch_refresh_token")
    ])
    assertSession(expected)
    const previous = local[REMEMBER_SESSION_KEY] !== false
    const token = previous ? local.twitch_refresh_token : session.twitch_refresh_token
    const copyTo = async (persistent) => {
      if (token) {
        await (persistent ? localSet : sessionSet)({ twitch_refresh_token: token })
      }
    }
    const removeOther = (persistent) =>
      (persistent ? sessionRemove : localRemove)("twitch_refresh_token")
    try {
      // Switch stores only after the destination is ready. Restore the original
      // mode on failure so a partial migration does not discard a valid session.
      await copyTo(enabled)
      await localSet({ [REMEMBER_SESSION_KEY]: enabled })
      await removeOther(enabled)
    } catch (error) {
      await copyTo(previous)
      await localSet({ [REMEMBER_SESSION_KEY]: previous })
      await removeOther(previous)
      throw error
    }
    return { rememberSession: enabled }
  })
}

function getRefreshToken(expected) {
  // Read the preference and its credential atomically with respect to migration.
  return queueCredentials(expected, async () => {
    const preferences = await localGet(REMEMBER_SESSION_KEY)
    const stored =
      preferences[REMEMBER_SESSION_KEY] !== false
        ? await localGet("twitch_refresh_token")
        : await sessionGet("twitch_refresh_token")
    return stored.twitch_refresh_token
  })
}

export async function clearTokens() {
  await sessionRemove(["twitch_access_token", "twitch_validated_at", "twitch_refresh_token"])
  await localRemove("twitch_refresh_token")
}

export function refreshSession() {
  if (refreshTask) return refreshTask
  const expected = revision
  refreshTask = guardSession(expected, async () => {
    const token = await getRefreshToken(expected)
    assertSession(expected)
    if (!token) throw new AuthError("Sign in required")
    const tokens = await requestTokens("refresh", { refresh_token: token })
    return saveTokens(tokens, expected)
  }).finally(() => {
    refreshTask = null
  })
  return refreshTask
}

export function restoreSession() {
  if (restoreTask) return restoreTask
  const expected = revision
  restoreTask = guardSession(expected, async () => {
    const { twitch_access_token: token, twitch_validated_at: validatedAt } = await sessionGet([
      "twitch_access_token",
      "twitch_validated_at"
    ])
    assertSession(expected)
    const age = Date.now() - validatedAt
    if (token && age >= 0 && age < 60 * 60 * 1000) return token
    if (token) {
      const response = await fetch("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${token}` },
        signal: AbortSignal.timeout(30000)
      })
      assertSession(expected)
      if (response.ok) {
        const data = await response.json()
        if (
          data.client_id !== CLIENT_ID ||
          !SCOPES.split(" ").every((scope) => data.scopes?.includes(scope))
        ) {
          throw new AuthError("Twitch authorization must be renewed")
        }
        assertSession(expected)
        await sessionSet({ twitch_validated_at: Date.now() })
        return token
      }
      if (response.status !== 401) throw new Error(`Token validation failed: ${response.status}`)
    }
    const refreshToken = await getRefreshToken(expected)
    assertSession(expected)
    if (token && !refreshToken) throw new AuthError("Sign in required")
    return refreshToken ? refreshSession() : null
  }).finally(() => {
    restoreTask = null
  })
  return restoreTask
}

export async function withSession(operation) {
  const expected = revision
  return guardSession(expected, async () => {
    let token = await restoreSession()
    assertSession(expected)
    if (!token) throw new AuthError("Sign in required")
    try {
      return await operation(token)
    } catch (error) {
      assertSession(expected)
      if (!(error instanceof AuthError)) throw error
      token = await refreshSession()
      assertSession(expected)
      return operation(token)
    }
  })
}

export function waitForSessionTasks() {
  return Promise.allSettled([refreshTask, restoreTask, ...tokenWrites].filter(Boolean))
}
