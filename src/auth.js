import { WORKER_URL } from "./config.js"
import { sendMessage } from "./platform.js"

export class AuthError extends Error {}

export function launchTwitchAuth() {
  // The background owns the entire flow so closing the sidebar cannot lose tokens.
  return sendMessage({ type: "TWITCH_AUTH" })
}

export async function requestTokens(endpoint, body) {
  const response = await fetch(`${WORKER_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    const message = data.error || "Token request failed"
    if (response.status === 400 || response.status === 401) throw new AuthError(message)
    throw new Error(message)
  }
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.refresh_token !== "string" ||
    !data.refresh_token
  ) {
    throw new Error("Invalid token response")
  }
  return data
}

export async function revokeToken(token) {
  if (!token) return
  try {
    await fetch(`${WORKER_URL}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(10000)
    })
  } catch (error) {
    console.error("Token revocation failed:", error)
  }
}
