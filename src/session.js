import { CLIENT_ID, SCOPES } from "./config.js"
import { AuthError, requestTokens } from "./auth.js"
import { localGet, localSet, localRemove, sessionGet, sessionSet, sessionRemove } from "./platform.js"

let revision = 0
let refreshTask
let restoreTask
const tokenWrites = new Set()
export const getSessionRevision = () => revision
export const invalidateSession = () => { revision++ }

export function assertSession(expected) {
  if (revision !== expected) throw new Error("Session changed")
}

export function saveTokens(tokens, expected = revision) {
  const task = (async () => {
    assertSession(expected)
    await localSet({ twitch_refresh_token: tokens.refresh_token })
    assertSession(expected)
    await sessionSet({ twitch_access_token: tokens.access_token, twitch_validated_at: 0 })
    assertSession(expected)
    return tokens.access_token
  })()
  tokenWrites.add(task)
  return task.finally(() => { tokenWrites.delete(task) })
}

export async function clearTokens() {
  await sessionRemove(["twitch_access_token", "twitch_validated_at"])
  await localRemove("twitch_refresh_token")
}

export function refreshSession() {
  if (refreshTask) return refreshTask
  const expected = revision
  refreshTask = (async () => {
    const { twitch_refresh_token: token } = await localGet("twitch_refresh_token")
    assertSession(expected)
    if (!token) throw new AuthError("Sign in required")
    const tokens = await requestTokens("refresh", { refresh_token: token })
    return saveTokens(tokens, expected)
  })().finally(() => { refreshTask = null })
  return refreshTask
}

export function restoreSession() {
  if (restoreTask) return restoreTask
  const expected = revision
  restoreTask = (async () => {
    const { twitch_access_token: token, twitch_validated_at: validatedAt } = await sessionGet([
      "twitch_access_token", "twitch_validated_at",
    ])
    assertSession(expected)
    const age = Date.now() - validatedAt
    if (token && age >= 0 && age < 60 * 60 * 1000) return token
    if (token) {
      const response = await fetch("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${token}` },
        signal: AbortSignal.timeout(30000),
      })
      assertSession(expected)
      if (response.ok) {
        const data = await response.json()
        if (data.client_id !== CLIENT_ID || !SCOPES.split(" ").every((scope) => data.scopes?.includes(scope))) {
          throw new AuthError("Twitch authorization must be renewed")
        }
        assertSession(expected)
        await sessionSet({ twitch_validated_at: Date.now() })
        return token
      }
      if (response.status !== 401) throw new Error(`Token validation failed: ${response.status}`)
    }
    const { twitch_refresh_token: refreshToken } = await localGet("twitch_refresh_token")
    assertSession(expected)
    if (token && !refreshToken) throw new AuthError("Sign in required")
    return refreshToken ? refreshSession() : null
  })().finally(() => { restoreTask = null })
  return restoreTask
}

export async function withSession(operation) {
  const expected = revision
  let token = await restoreSession()
  assertSession(expected)
  if (!token) throw new AuthError("Sign in required")
  try {
    return await operation(token)
  } catch (error) {
    if (!(error instanceof AuthError)) throw error
    token = await refreshSession()
    assertSession(expected)
    return operation(token)
  }
}

export function waitForSessionTasks() {
  return Promise.allSettled([refreshTask, restoreTask, ...tokenWrites].filter(Boolean))
}
