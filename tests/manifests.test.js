import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const readManifest = async (browser) =>
  JSON.parse(await readFile(`${root}/manifests/manifest.${browser}.json`, "utf8"))
const browsers = ["chrome", "firefox"]

async function readSources(directory = `${root}/src`) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? readSources(`${directory}/${entry.name}`)
        : readFile(`${directory}/${entry.name}`, "utf8")
    )
  )
  return files.flat().join("\n")
}

function parsePolicy(policy) {
  return Object.fromEntries(
    policy
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...values] = directive.split(/\s+/)
        return [name, values]
      })
  )
}

const sources = await readSources()
// Every https origin named in the extension code. fetch() and <img> are governed by
// connect-src and img-src, so an origin missing there fails silently at runtime.
const origins = new Set(
  [...sources.matchAll(/https:\/\/[a-z0-9][a-z0-9.-]*/gi)].map((match) => match[0].toLowerCase())
)
// Opened with tabs.create/launchWebAuthFlow, which no CSP directive restricts.
const navigationOnly = new Set(["https://www.twitch.tv"])
// Avatar URLs come from the API response and are prefetched with fetch() by
// fetchImageAsDataUrl, so this origin only appears at runtime.
const avatarOrigin = "https://static-cdn.jtvnw.net"

test("both manifests declare the same extension pages policy", async () => {
  const [chrome, firefox] = await Promise.all(browsers.map(readManifest))
  assert.equal(
    chrome.content_security_policy.extension_pages,
    firefox.content_security_policy.extension_pages
  )
})

for (const browser of browsers) {
  test(`${browser}: every origin used by the code is allowed by the CSP and host permissions`, async () => {
    const manifest = await readManifest(browser)
    const policy = parsePolicy(manifest.content_security_policy.extension_pages)
    assert.deepEqual(policy["script-src"], ["'self'"])
    assert.deepEqual(policy["object-src"], ["'none'"])
    assert.ok(origins.size > 0)
    for (const origin of [...origins, avatarOrigin]) {
      if (navigationOnly.has(origin)) continue
      assert.ok(
        policy["connect-src"].includes(origin),
        `${browser} connect-src must allow ${origin} (fetch is blocked otherwise)`
      )
      assert.ok(
        manifest.host_permissions.some((permission) => permission.startsWith(`${origin}/`)),
        `${browser} host_permissions must allow ${origin}`
      )
    }
    // Avatar <img> elements need the CDN in img-src as well.
    assert.ok(policy["img-src"].includes(avatarOrigin))
  })
}
