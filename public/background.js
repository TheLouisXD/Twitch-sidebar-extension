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
const SCOPES    = "user:read:follows moderator:read:followers";

// Badge styling — purple Twitch accent
chrome.action.setBadgeBackgroundColor({ color: "#9147ff" });

// Open the side panel when the action button is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from the side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // ── Update badge with live channel count ──
  if (message.type === "SET_BADGE") {
    const count = message.count;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    sendResponse({ ok: true });
    return false;
  }

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
      response_type:         "code",
      scope:                 SCOPES,
      force_verify:          "false",
      code_challenge:        message.code_challenge,
      code_challenge_method: "S256",
    });

    const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;

    try {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (redirect) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message ?? "Unknown error" });
            return;
          }
          if (!redirect) {
            sendResponse({ error: "Auth cancelled or no redirect" });
            return;
          }

          try {
            // Auth Code comes in the query string (?code=...), NOT the hash
            const url  = new URL(redirect);
            const code = url.searchParams.get("code");

            if (code) {
              sendResponse({ code });
            } else {
              const error = url.searchParams.get("error_description")
                         || url.searchParams.get("error")
                         || "No code in redirect";
              sendResponse({ error });
            }
          } catch (_) {
            sendResponse({ error: "Failed to parse redirect URL" });
          }
        }
      );
    } catch (e) {
      sendResponse({ error: e.message });
    }

    // Keep message channel open for async response
    return true;
  }
});
