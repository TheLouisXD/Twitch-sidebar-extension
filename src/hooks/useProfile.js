import { useEffect, useState } from "react"
import { extension, sendMessage } from "../platform.js"
import { sampleAverageColor } from "../image-color.js"
import { USER_PROFILE_KEY, getCachedUserProfile } from "../cache.js"

function profilesEqual(a, b) {
  if (!a || !b) return a === b
  return (
    a.id === b.id &&
    a.display_name === b.display_name &&
    a.login === b.login &&
    a.profile_image_url === b.profile_image_url &&
    a.avatar_data === b.avatar_data &&
    a.followers === b.followers
  )
}

export function useProfile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [colors, setColors] = useState(undefined)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    function applyColors(targetProfile) {
      if (!targetProfile) return
      if (targetProfile.colors) {
        setColors(targetProfile.colors)
        return
      }
      const imageUrl = targetProfile.avatar_data || targetProfile.profile_image_url
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

    // Listen to background cache updates from storage
    const onChanged = (changes, area) => {
      if (area !== "local" || !changes[USER_PROFILE_KEY]) return
      const updated = changes[USER_PROFILE_KEY].newValue?.profile
      if (!active || !updated) return
      setUser((current) => (profilesEqual(current, updated) ? current : updated))
      setLoading(false)
      applyColors(updated)
    }
    if (extension?.storage?.onChanged?.addListener) {
      extension.storage.onChanged.addListener(onChanged)
    }

    // 1. Immediately display cached profile if available to eliminate loading delay
    getCachedUserProfile()
      .then((cached) => {
        if (!active || !cached?.profile) return
        setUser((current) => (profilesEqual(current, cached.profile) ? current : cached.profile))
        setLoading(false)
        applyColors(cached.profile)
      })
      .catch(() => {})

    // 2. Fetch fresh profile in background and update if changed
    sendMessage({ type: "GET_PROFILE" })
      .then(({ profile }) => {
        if (!active || !profile) return
        setUser((current) => (profilesEqual(current, profile) ? current : profile))
        setLoading(false)
        applyColors(profile)
      })
      .catch((failure) => {
        setUser((current) => {
          if (!current && active) setError(failure)
          return current
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
      if (extension?.storage?.onChanged?.removeListener) {
        extension.storage.onChanged.removeListener(onChanged)
      }
    }
  }, [])

  return { user, loading, error, colors }
}
