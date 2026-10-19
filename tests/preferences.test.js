import test from "node:test"
import assert from "node:assert/strict"
import { normalizePollInterval, normalizeTheme } from "../src/preferences.js"
import { search } from "../src/search.js"

const channels = [
  { user_id: "1", user_name: "Canal Uno", viewer_count: 1000, game_name: "Juego" },
  { user_id: "2", user_name: "Canal Dos", viewer_count: 500, game_name: "Juego" },
  { user_id: "3", user_name: "Canal Tres", viewer_count: 100, game_name: "Juego" },
  { user_id: "4", user_name: "Canal Cuatro", viewer_count: 10, game_name: "Otro" }
]

test("search keeps the viewer order of the live list and never mutates it", () => {
  const { filteredLive, filteredOffline } = search(channels, [...channels].reverse(), "Juego")
  assert.deepEqual(
    filteredLive.map(({ user_id }) => user_id),
    ["1", "2", "3"]
  )
  assert.deepEqual(
    channels.map(({ user_id }) => user_id),
    ["1", "2", "3", "4"]
  )
  assert.deepEqual(filteredOffline, [])
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
