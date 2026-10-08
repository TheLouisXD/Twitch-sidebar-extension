import test from "node:test"
import assert from "node:assert/strict"
import { createPlatform } from "../src/platform.js"
import { parseAuthRedirect } from "../src/oauth.js"

test("Firefox APIs use Promises without callbacks and preserve the owner", async () => {
  const browser = {
    runtime: { id: "test" },
    sidebarAction: {},
    storage: {
      local: {
        async get(key) {
          assert.equal(this, browser.storage.local)
          return { [key]: 3 }
        }
      }
    }
  }
  const platform = createPlatform({ browser })
  assert.equal(platform.isFirefox, true)
  assert.deepEqual(await platform.call("storage.local.get", "value"), { value: 3 })
  await assert.rejects(platform.call("missing.method"), /unavailable/)
})

test("Chrome callback failures reject using runtime.lastError", async () => {
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(key, callback) {
          chrome.runtime.lastError = { message: "Storage unavailable" }
          callback()
          delete chrome.runtime.lastError
        }
      }
    }
  }
  await assert.rejects(
    createPlatform({ chrome }).call("storage.local.get", "value"),
    /Storage unavailable/
  )
})

test("Chrome sidePanel uses its Promise API synchronously inside the gesture", async () => {
  let invoked = false
  const chrome = {
    runtime: {},
    sidePanel: {
      open(...args) {
        assert.equal(args.length, 1)
        invoked = true
        return Promise.resolve()
      }
    }
  }
  const operation = createPlatform({ chrome }).call("sidePanel.open", { windowId: 1 })
  assert.equal(invoked, true)
  await operation
})

test("OAuth accepts only the expected origin, path and random state", () => {
  const uri = "https://test.extensions.allizom.org/"
  assert.equal(parseAuthRedirect(`${uri}?code=abc&state=expected`, uri, "expected"), "abc")
  for (const redirect of [
    `${uri}?code=abc&state=wrong`,
    `${uri}other?code=abc&state=expected`,
    "https://attacker.example/?code=abc&state=expected"
  ])
    assert.throws(() => parseAuthRedirect(redirect, uri, "expected"), /Invalid OAuth/)
  assert.throws(
    () => parseAuthRedirect(`${uri}?error=access_denied&state=expected`, uri, "expected"),
    /access_denied/
  )
})
