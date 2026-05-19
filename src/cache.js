// ── Cache utility (chrome.storage.local) ─────────────────────
//
// Two separate caches:
//   • "twitch_channels"  → { live, offline } data  (5 min TTL)
//   • "twitch_profiles"  → { [userId]: profileUrl } (24 h TTL)

const CHANNELS_KEY  = "twitch_channels_cache"
const PROFILES_KEY  = "twitch_profiles_cache"

const FIVE_MINUTES  = 5 * 60 * 1000
const TWENTY_FOUR_H = 24 * 60 * 60 * 1000

// ── Generic helpers ──────────────────────────────────────────

function storageGet(key) {
  return new Promise((resolve) =>
    chrome.storage.local.get(key, (result) => resolve(result[key] ?? null))
  )
}

function storageSet(key, value) {
  return new Promise((resolve) =>
    chrome.storage.local.set({ [key]: value }, resolve)
  )
}

function isFresh(timestamp, maxAgeMs) {
  return timestamp && Date.now() - timestamp < maxAgeMs
}

// ── Channel cache (5 min) ────────────────────────────────────

export async function getCachedChannels() {
  const entry = await storageGet(CHANNELS_KEY)
  if (!entry) return null
  return {
    data:    entry.data,          // { live: [...], offline: [...] }
    fresh:   isFresh(entry.ts, FIVE_MINUTES),
    ts:      entry.ts,
  }
}

export async function setCachedChannels(data) {
  await storageSet(CHANNELS_KEY, { data, ts: Date.now() })
}

// ── Profile cache (24 h) ─────────────────────────────────────

export async function getCachedProfiles() {
  const entry = await storageGet(PROFILES_KEY)
  if (!entry) return { map: {}, fresh: false }
  return {
    map:   entry.map,             // { [userId]: profileImageUrl }
    fresh: isFresh(entry.ts, TWENTY_FOUR_H),
  }
}

export async function setCachedProfiles(map) {
  await storageSet(PROFILES_KEY, { map, ts: Date.now() })
}

export function clearAllCache() {
  return new Promise((resolve) =>
    chrome.storage.local.remove([CHANNELS_KEY, PROFILES_KEY], resolve)
  )
}
