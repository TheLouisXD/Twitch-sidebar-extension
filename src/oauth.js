export function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function parseAuthRedirect(redirect, redirectUri, state) {
  if (!redirect) throw new Error("Authentication cancelled")
  const actual = new URL(redirect)
  const expected = new URL(redirectUri)
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname ||
      actual.searchParams.get("state") !== state) {
    throw new Error("Invalid OAuth redirect or state")
  }
  if (actual.searchParams.has("error")) {
    throw new Error(actual.searchParams.get("error_description") || actual.searchParams.get("error"))
  }
  const code = actual.searchParams.get("code")
  if (!code) throw new Error("No authorization code in redirect")
  return code
}
