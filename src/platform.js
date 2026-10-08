// Firefox exposes Promise APIs through browser; Chrome supports callbacks.
// Choose the namespace explicitly: native function arity is not reliable.
export function createPlatform(scope = globalThis) {
  const usesPromises = Boolean(scope.browser?.runtime?.id)
  const api = usesPromises ? scope.browser : scope.chrome

  function call(path, ...args) {
    const parts = path.split(".")
    const method = parts.pop()
    const owner = parts.reduce((value, key) => value?.[key], api)
    if (typeof owner?.[method] !== "function") {
      return Promise.reject(new Error(`Extension API unavailable: ${path}`))
    }
    // These Chrome APIs use the documented Promise interface (minimum 116).
    if (usesPromises || path.startsWith("sidePanel.") || path === "alarms.create") {
      try {
        return Promise.resolve(owner[method](...args))
      } catch (error) {
        return Promise.reject(error)
      }
    }
    return new Promise((resolve, reject) => {
      owner[method](...args, (result) => {
        const error = api.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve(result)
      })
    })
  }
  return { api, call, isFirefox: Boolean(api?.sidebarAction) }
}

export const { api: extension, call: callExtension, isFirefox } = createPlatform()

export async function sendMessage(message) {
  const response = await callExtension("runtime.sendMessage", message)
  if (!response) throw new Error("No response from background")
  if (response.error) {
    const error = new Error(response.error)
    error.code = response.code
    throw error
  }
  return response
}

export const localGet = (keys) => callExtension("storage.local.get", keys)
export const localSet = (values) => callExtension("storage.local.set", values)
export const localRemove = (keys) => callExtension("storage.local.remove", keys)
export const sessionGet = (keys) => callExtension("storage.session.get", keys)
export const sessionSet = (values) => callExtension("storage.session.set", values)
export const sessionRemove = (keys) => callExtension("storage.session.remove", keys)

export function openChannel(login) {
  if (!/^[a-zA-Z0-9_]+$/.test(login ?? "")) {
    return Promise.reject(new Error("Invalid Twitch channel"))
  }
  return callExtension("tabs.create", { url: `https://www.twitch.tv/${login}` })
}
