// ── Twitch Auth (Authorization Code + PKCE) ─────────────────
//
// Flow:
//   1. Generate PKCE code_verifier + code_challenge
//   2. Send code_challenge to background → launchWebAuthFlow → get code
//   3. Send code + code_verifier to Cloudflare Worker → get tokens
//
// The client_secret NEVER touches this code — it lives only in
// the Cloudflare Worker's encrypted secrets.

export const CLIENT_ID = "7wvduf9b5669znfl36ey3oraencfv8"
export const SCOPES   = "user:read:follows"

// ⚠️ IMPORTANT: After deploying your Cloudflare Worker, replace this URL.
// Run `npx wrangler deploy` and paste the URL it gives you here.
export const WORKER_URL = "https://twitch-auth-worker.thelouisxd.workers.dev"

// ── PKCE helpers ─────────────────────────────────────────────

/**
 * Generate a cryptographically random code_verifier (43–128 chars, URL-safe)
 */
function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Derive the code_challenge = BASE64URL(SHA256(code_verifier))
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64-URL encode (no padding, URL-safe chars)
 */
function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// ── Auth flow ────────────────────────────────────────────────

/**
 * Full Authorization Code + PKCE flow:
 *
 * 1. Generate PKCE pair
 * 2. Ask background service worker to launch the auth popup
 *    → user authorizes → Twitch redirects with ?code=...
 * 3. Exchange the code via the Cloudflare Worker (adds client_secret)
 *
 * Returns: { access_token, refresh_token, expires_in }
 */
export async function launchTwitchAuth() {
  // 1. PKCE
  const codeVerifier  = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // 2. Get authorization code from background
  const code = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "TWITCH_AUTH",
        code_challenge: codeChallenge,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message))
        }
        if (!response) {
          return reject(new Error("No response from background"))
        }
        if (response.error) {
          return reject(new Error(response.error))
        }
        resolve(response.code)
      }
    )
  })

  // 3. Get redirect_uri from background (needed for token exchange)
  const redirectUri = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TWITCH_GET_REDIRECT_URL" },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message))
        }
        resolve(response.redirectUrl)
      }
    )
  })

  // 4. Exchange code + verifier for tokens via Cloudflare Worker
  const tokenRes = await fetch(`${WORKER_URL}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri:  redirectUri,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || tokenData.error) {
    throw new Error(tokenData.error || "Token exchange failed")
  }

  return {
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in:    tokenData.expires_in,
  }
}

// ── Refresh ──────────────────────────────────────────────────

/**
 * Refresh an expired access_token using the stored refresh_token.
 * Returns: { access_token, refresh_token, expires_in }
 */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${WORKER_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error || "Token refresh failed")
  }

  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_in:    data.expires_in,
  }
}