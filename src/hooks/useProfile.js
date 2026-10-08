import { useEffect, useState } from "react"
import { sendMessage } from "../platform.js"
import { sampleAverageColor } from "../image-color.js"

export function useProfile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [colors, setColors] = useState(undefined)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    sendMessage({ type: "GET_PROFILE" })
      .then(({ profile }) => {
        if (!active || !profile) return
        setUser(profile)
        if (profile.profile_image_url) {
          // Decorative image work must never delay preferences or sign-out.
          sampleAverageColor(profile.profile_image_url, { signal: controller.signal }).then(
            (color) => {
              if (!active || !color) return
              const [r, g, b] = color
              setColors({
                "--profile-tint": `rgba(${r}, ${g}, ${b}, 0.45)`,
                "--profile-dark": `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)})`
              })
            }
          )
        }
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
