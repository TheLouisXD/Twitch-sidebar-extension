// Open the side panel when the action button is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle auth requests from the side panel.
// launchWebAuthFlow MUST run in the background service worker.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TWITCH_GET_REDIRECT_URL") {
    // Let the side panel know the redirect URL so the user can verify it
    sendResponse({ redirectUrl: chrome.identity.getRedirectURL() });
    return false;
  }

  if (message.type === "TWITCH_AUTH") {
    const redirectUri = chrome.identity.getRedirectURL();

    console.log("[Twitch Auth] Redirect URI:", redirectUri);

    const params = new URLSearchParams({
      client_id: message.clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: message.scopes,
      force_verify: "false",
    });
    const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;

    console.log("[Twitch Auth] Auth URL:", authUrl);

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
            const hash = new URL(redirect).hash.substring(1);
            const p = Object.fromEntries(new URLSearchParams(hash));
            if (p.access_token) {
              sendResponse({ token: p.access_token });
            } else {
              console.error("[Twitch Auth] No access_token in hash:", hash);
              sendResponse({ error: "No access_token in redirect" });
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
