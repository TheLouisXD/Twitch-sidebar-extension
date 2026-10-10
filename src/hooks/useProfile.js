import { useEffect, useState } from "react"
import { sendMessage } from "../platform.js"
import { sampleAverageColor } from "../image-color.js"
import { getCachedUserProfile } from "../cache.js"

export function useProfile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [colors, setColors] = useState(undefined)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    function applyColors(imageUrl) {
      if (!imageUrl) return
      // Decorative image work must never delay preferences or sign-out.
      sampleAverageColor(imageUrl, { signal: controller.signal }).then((color) => {
        if (!active || !color) return
        const [r, g, b] = color
        setColors({
          "--profile-tint": `rgba(${r}, ${g}, ${b}, 0.45)`,
          "--profile-dark": `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)})`
        })
      })
    }

    // 1. Immediately display cached profile if available to eliminate loading delay
    getCachedUserProfile()
      .then((cached) => {
        if (!active || !cached?.profile) return
        setUser(cached.profile)
        setLoading(false)
        applyColors(cached.profile.profile_image_url)
      })
      .catch(() => {})

    // 2. Fetch fresh profile in background
    sendMessage({ type: "GET_PROFILE" })
      .then(({ profile }) => {
        if (!active || !profile) return
        setUser(profile)
        applyColors(profile.profile_image_url)
      })
      .catch((failure) => {
        if (active) setError(failure)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return { user, loading, error, colors }
}
