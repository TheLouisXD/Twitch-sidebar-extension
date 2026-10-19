/** Average mid-tone pixels; this is a decorative approximation, not a dominant-color histogram. */
export function sampleAverageColor(imageUrl, { signal, timeoutMs = 3000 } = {}) {
  if (signal?.aborted || !imageUrl || typeof imageUrl !== "string") return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    let timer
    let settled = false
    const finish = (color) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      img.onload = null
      img.onerror = null
      img.src = ""
      resolve(color)
    }
    const onAbort = () => finish(null)
    signal?.addEventListener("abort", onAbort, { once: true })
    timer = setTimeout(onAbort, timeoutMs)
    if (!imageUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext("2d")
        if (!ctx) return finish(null)
        ctx.drawImage(img, 0, 0, 16, 16)
        const pixels = ctx.getImageData(0, 0, 16, 16).data
        const sums = [0, 0, 0]
        let count = 0
        const addPixel = (index, midTonesOnly) => {
          if (pixels[index + 3] === 0) return
          const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3
          if (midTonesOnly && (brightness <= 30 || brightness >= 240)) return
          sums[0] += pixels[index]
          sums[1] += pixels[index + 1]
          sums[2] += pixels[index + 2]
          count++
        }
        for (let i = 0; i < pixels.length; i += 4) addPixel(i, true)
        if (!count) {
          // Almost white or almost black avatars have no mid-tone pixels; average
          // every opaque pixel so the tint is not lost entirely.
          for (let i = 0; i < pixels.length; i += 4) addPixel(i, false)
        }
        finish(count ? sums.map((sum) => Math.round(sum / count)) : null)
      } catch {
        finish(null)
      }
    }
    img.onerror = onAbort
    img.src = imageUrl
  })
}
