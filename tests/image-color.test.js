import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

const originalDocument = globalThis.document
const originalImage = globalThis.Image

function stubImage(behavior) {
  globalThis.Image = class {
    set src(value) {
      if (!value) return
      queueMicrotask(() => behavior(value, this))
    }
  }
}

function stubCanvas(pixels) {
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas")
      return {
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: Uint8ClampedArray.from(pixels) })
        })
      }
    }
  }
}

afterEach(() => {
  globalThis.document = originalDocument
  globalThis.Image = originalImage
})

const { sampleAverageColor } = await import("../src/image-color.js")

test("averages only mid-tone opaque pixels", async () => {
  stubImage((url, img) => img.onload())
  stubCanvas([240, 60, 40, 255, 200, 100, 80, 255, 255, 255, 255, 255])
  assert.deepEqual(await sampleAverageColor("https://example.test/color.png"), [220, 80, 60])
})

test("falls back to every opaque pixel when no mid tones exist", async () => {
  stubImage((url, img) => img.onload())
  // Brightness 250 and 10 are outside the 30-240 band, so the mid-tone pass
  // finds nothing and the backup average must still return a color.
  stubCanvas([250, 250, 250, 255, 10, 10, 10, 255, 0, 0, 0, 0])
  assert.deepEqual(await sampleAverageColor("https://example.test/gray.png"), [130, 130, 130])
})

test("ignores transparent pixels", async () => {
  stubImage((url, img) => img.onload())
  stubCanvas([120, 120, 120, 255, 0, 255, 0, 0])
  assert.deepEqual(await sampleAverageColor("https://example.test/alpha.png"), [120, 120, 120])
})

test("keeps the origin anonymous for https avatars but not for data urls", async () => {
  const seen = []
  stubImage((url, img) => {
    seen.push({ url, crossOrigin: img.crossOrigin ?? null })
    img.onload()
  })
  stubCanvas([120, 120, 120, 255])
  await sampleAverageColor("data:image/png;base64,AAA")
  await sampleAverageColor("https://example.test/remote.png")
  assert.deepEqual(seen, [
    { url: "data:image/png;base64,AAA", crossOrigin: null },
    { url: "https://example.test/remote.png", crossOrigin: "anonymous" }
  ])
})

test("returns null when the image fails to load", async () => {
  stubImage((url, img) => img.onerror())
  stubCanvas([120, 120, 120, 255])
  assert.equal(await sampleAverageColor("https://example.test/broken.png"), null)
})

test("returns null for missing or invalid urls", async () => {
  assert.equal(await sampleAverageColor(null), null)
  assert.equal(await sampleAverageColor(42), null)
})

test("returns null when the load times out", async () => {
  stubImage(() => {})
  stubCanvas([120, 120, 120, 255])
  assert.equal(await sampleAverageColor("https://example.test/slow.png", { timeoutMs: 5 }), null)
})
