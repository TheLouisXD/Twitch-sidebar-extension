import { useEffect, useState } from "react"
import { extension, localGet } from "../platform.js"

export const asBoolean = (value) => value === true
export const asRememberSession = (value) => value !== false

/** Keep a local preference synchronized without an old read overwriting a newer event. */
export function useStoredValue(key, fallback, normalize) {
  const [value, setValue] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    let changed = false
    const onChanged = (changes, area) => {
      if (area !== "local" || !changes[key]) return
      changed = true
      setValue(normalize(changes[key].newValue))
      setError(null)
    }
    extension.storage.onChanged.addListener(onChanged)
    localGet(key)
      .then((stored) => {
        if (active && !changed) setValue(normalize(stored[key]))
      })
      .catch((failure) => {
        if (active && !changed) setError(failure)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      extension.storage.onChanged.removeListener(onChanged)
    }
  }, [key, normalize])

  return { value, loading, error }
}
