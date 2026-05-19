export const CLIENT_ID = "ngqxoj11rdaa0qmf6fzuhisogl09p4"
export const SCOPES = "user:read:follows"

/**
 * Launches the Twitch OAuth flow by delegating to the background service worker.
 * (launchWebAuthFlow is not available directly in the side panel context.)
 */
export function launchTwitchAuth() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TWITCH_AUTH", clientId: CLIENT_ID, scopes: SCOPES },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message))
        }
        if (!response) {
          return reject(new Error("No response from background"))
        }
        if (response.error) {
          return reject(new Error(response.error))
        }
        resolve(response.token)
      }
    )
  })
}