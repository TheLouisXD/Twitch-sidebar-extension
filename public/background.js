// ── Background Service Worker ────────────────────────────────
//
// Handles:
//   1. Opening the side panel when the extension icon is clicked
//   2. Launching the Twitch OAuth popup (Authorization Code + PKCE)
//   3. Returning the redirect URL to the side panel
//
// Security: CLIENT_ID and SCOPES are hardcoded here — they are
// NOT accepted from messages to prevent parameter injection.

const CLIENT_ID = "7wvduf9b5669znfl36ey3oraencfv8";
const SCOPES    = "user:read:follows";

// Open the side panel when the action button is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from the side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // ── Return the redirect URL ──
  if (message.type === "TWITCH_GET_REDIRECT_URL") {
    sendResponse({ redirectUrl: chrome.identity.getRedirectURL() });
    return false;
  }

  // ── Authorization Code + PKCE flow ──
  if (message.type === "TWITCH_AUTH") {
    const redirectUri = chrome.identity.getRedirectURL();

    // Build the authorization URL with PKCE params
    const params = new URLSearchParams({
      client_id:             CLIENT_ID,
      redirect_uri:          redirectUri,
      response_type:         "code",              // ← Auth Code, not token
      scope:                 SCOPES,
      force_verify:          "false",
      code_challenge:        message.code_challenge,
      code_challenge_method: "S256",
    });

    const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;

    console.log("[Twitch Auth] Launching auth flow...");
    console.log("[Twitch Auth] Redirect URI:", redirectUri);

    try {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (redirect) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message ?? "Unknown error";
            console.error("[Twitch Auth] lastError:", msg);
            sendResponse({ error: msg });
            return;
          }
          if (!redirect) {
            console.error("[Twitch Auth] No redirect URL returned");
            sendResponse({ error: "Auth cancelled or no redirect" });
            return;
          }

          console.log("[Twitch Auth] Redirect received:", redirect);

          try {
            // Auth Code comes in the query string (?code=...), NOT the hash
            const url  = new URL(redirect);
            const code = url.searchParams.get("code");

            if (code) {
              console.log("[Twitch Auth] Code received successfully");
              sendResponse({ code });
            } else {
              // Check for error from Twitch
              const error = url.searchParams.get("error_description")
                         || url.searchParams.get("error")
                         || "No code in redirect";
              console.error("[Twitch Auth] Error:", error);
              sendResponse({ error });
            }
          } catch (parseErr) {
            console.error("[Twitch Auth] Parse error:", parseErr);
            sendResponse({ error: "Failed to parse redirect URL" });
          }
        }
      );
    } catch (e) {
      console.error("[Twitch Auth] Exception:", e);
      sendResponse({ error: e.message });
    }

    // Keep message channel open for async response
    return true;
  }
});
