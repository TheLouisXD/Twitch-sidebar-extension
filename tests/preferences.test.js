import test from "node:test"
import assert from "node:assert/strict"
import { normalizePollInterval, normalizeTheme, orderLiveChannels } from "../src/preferences.js"
import { search } from "../src/search.js"

const channels = [
  { user_id: "1", user_name: "Canal Uno", viewer_count: 1000, game_name: "Juego" },
  { user_id: "2", user_name: "Canal Dos", viewer_count: 500, game_name: "Juego" },
  { user_id: "3", user_name: "Canal Tres", viewer_count: 100, game_name: "Juego" },
  { user_id: "4", user_name: "Canal Cuatro", viewer_count: 10, game_name: "Otro" }
]

test("favorite priority preserves viewer order within groups and never mutates the cached list", () => {
  const favorites = new Set(["2", "4", "offline-channel"])
  const ordered = orderLiveChannels(channels, favorites, true)
  assert.deepEqual(
    ordered.map(({ user_id }) => user_id),
    ["2", "4", "1", "3"]
  )
  assert.deepEqual(
    channels.map(({ user_id }) => user_id),
    ["1", "2", "3", "4"]
  )
  assert.equal(orderLiveChannels(channels, favorites, false), channels)
})

test("changing bell preferences immediately changes priority while searching preserves that order", () => {
  const favorites = new Set(["2", "4"])
  favorites.delete("2")
  favorites.add("3")
  const ordered = orderLiveChannels(channels, favorites, true)
  assert.deepEqual(
    ordered.map(({ user_id }) => user_id),
    ["3", "4", "1", "2"]
  )
  assert.deepEqual(
    search(ordered, [], "Juego").filteredLive.map(({ user_id }) => user_id),
    ["3", "1", "2"]
  )
  assert.equal(channels.length, 4)
})

test("all or no favorites keep the existing viewer order", () => {
  assert.deepEqual(orderLiveChannels(channels, new Set(), true), channels)
  assert.deepEqual(orderLiveChannels(channels, new Set(["1", "2", "3", "4"]), true), channels)
  assert.deepEqual(orderLiveChannels([], new Set(["1"]), true), [])
})

test("stored intervals use supported choices with a three-minute default", () => {
  for (const value of [1, 2, 3, 5, 10, 15, 30, 60])
    assert.equal(normalizePollInterval(value), value)
  for (const value of [undefined, null, 0, -1, 4, "5", NaN])
    assert.equal(normalizePollInterval(value), 3)
})

test("stored themes use supported choices with a default fallback", () => {
  assert.equal(normalizeTheme("default"), "default")
  assert.equal(normalizeTheme("gx"), "gx")
  for (const value of [undefined, null, "", "dark", "light", 123])
    assert.equal(normalizeTheme(value), "default")
})
