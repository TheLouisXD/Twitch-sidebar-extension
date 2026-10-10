# Chrome Web Store Listing — Twitch Live Sidebar

> Last Updated: 2025-05-18

## Store Listing

**Extension Name** [REQUIRED]
Twitch Live Sidebar

**Short Description** [REQUIRED]
Check which of your followed Twitch channels are live directly from your sidebar.

**Detailed Description** [REQUIRED]
Check which of your followed Twitch channels are currently live directly from your browser's side panel, without interrupting your current tab.

FEATURES
• Live Stream Status — Instantly see which followed channels are streaming.
• Native Side Panel — Open Twitch directly alongside your browsing experience.
• Favorites Priority — Star your favorite streamers to keep them pinned at the top of your list.
• Stream Previews & Viewers — View live game titles, viewer counts, and avatar previews.
• Fast Search — Quickly filter through all your followed channels.
• Customizable Themes — Choose between Default Twitch dark mode and GX gaming theme.
• Configurable Refresh Intervals — Set automatic background polling intervals according to your preference.
• Zero Distractions — Quick, clean, and lightweight interface.

HOW TO USE

1. Click the Twitch Live Sidebar icon in your browser toolbar to open the side panel.
2. Sign in with your Twitch account to grant read access to your followed channels.
3. Browse live channels, search for specific creators, and click any stream to watch on Twitch.
4. Click the star icon next to any channel to prioritize it at the top of your list.

PRIVACY
Twitch Live Sidebar respects your privacy. It does not collect, track, or sell any personal data or browsing activity. All authentication tokens and user preferences are stored securely and locally on your device.

PERMISSIONS
• "storage" — Saves your local settings (such as refresh interval, theme, and starred channels) and stream cache.
• "identity" — Allows secure OAuth2 login through Twitch's official authentication page.
• "sidePanel" — Displays your followed streams in Chrome's native side panel.
• "alarms" — Periodically checks for newly active live streams at your chosen interval.

SUPPORT
Need help or want to suggest a feature?
GitHub Repository: https://github.com/thelouisxd/twitch-sidebar
Issues: https://github.com/thelouisxd/twitch-sidebar/issues

Version 1.1 — Added favorite streamer priority, customizable themes, refined accessibility, and performance improvements.

**Category** [REQUIRED]
Social & Communication

**Single Purpose** [REQUIRED]
Displays the live status and streams of your followed Twitch channels directly in the browser sidebar.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset                          | Dimensions  | Status         | Filename                  |
| ------------------------------ | ----------- | -------------- | ------------------------- |
| Store Icon [REQUIRED]          | 128×128 PNG | ✅ Ready       | `icons/icon128.png`       |
| Screenshot 1 [REQUIRED]        | 1280×800    | ⬜ Not created | `promo/screenshot-1.png`  |
| Screenshot 2 [RECOMMENDED]     | 1280×800    | ⬜ Not created | `promo/screenshot-2.png`  |
| Small Promo Tile [RECOMMENDED] | 440×280     | ⬜ Not created | `promo/promo-small.png`   |
| Marquee Promo Tile             | 1400×560    | ⬜ Not created | `promo/promo-marquee.png` |

---

## Permissions Justification

| Permission                                            | Type             | Justification                                                                                                                                              |
| ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                             | permissions      | Used to store user preferences (polling interval, favorite creators, theme) and temporarily cache followed stream lists for instant sidebar loading.       |
| `identity`                                            | permissions      | Used to launch official Twitch OAuth2 web authentication flow via `chrome.identity.launchWebAuthFlow` so users can authenticate with their Twitch account. |
| `sidePanel`                                           | permissions      | Used to display the followed streams viewer within Chrome's native side panel interface.                                                                   |
| `alarms`                                              | permissions      | Used to schedule background checks to refresh the live status of followed channels at the user-configured interval.                                        |
| `https://api.twitch.tv/*`                             | host_permissions | Required to fetch user's followed channels, live stream metadata, viewer counts, and profile info from Twitch's official Helix REST API.                   |
| `https://id.twitch.tv/*`                              | host_permissions | Required to validate authentication tokens and revoke access tokens upon logging out.                                                                      |
| `https://static-cdn.jtvnw.net/*`                      | host_permissions | Required to display streamer profile avatars and stream thumbnail preview images directly from Twitch CDN.                                                 |
| `https://twitch-auth-worker.thelouisxd.workers.dev/*` | host_permissions | Required to securely exchange OAuth2 authorization codes for access tokens with the server-side backend without exposing client secrets.                   |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes (Authentication tokens and user preferences only)

| Data Type                    | Collected? | Transmitted Off-Device?      | Purpose                                                 | Shared with Third Parties? |
| ---------------------------- | ---------- | ---------------------------- | ------------------------------------------------------- | -------------------------- |
| Personally identifiable info | No         | No                           | N/A                                                     | No                         |
| Health info                  | No         | No                           | N/A                                                     | No                         |
| Financial info               | No         | No                           | N/A                                                     | No                         |
| Authentication info          | Yes        | Yes (to Twitch & auth proxy) | Authenticating with Twitch API to read followed streams | No                         |
| Personal communications      | No         | No                           | N/A                                                     | No                         |
| Location                     | No         | No                           | N/A                                                     | No                         |
| Web history                  | No         | No                           | N/A                                                     | No                         |
| User activity                | No         | No                           | N/A                                                     | No                         |
| Website content              | No         | No                           | N/A                                                     | No                         |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used or transferred for purposes unrelated to the item's core functionality
- [x] Data is NOT used or transferred to determine creditworthiness or for lending purposes

---

## Review Checklist

- [x] Manifest V3 compliant (`manifest_version: 3`)
- [x] All icon resolutions exist physically (16, 32, 48, 128)
- [x] Minimum Chrome version specified (`116` for `chrome.sidePanel`)
- [x] Side panel opens cleanly via `setPanelBehavior` and action click
- [x] No `eval()` or remotely hosted scripts; all JS bundled locally
- [x] Least privilege permissions: only `storage`, `identity`, `sidePanel`, `alarms`
- [x] Host permissions strictly limited to required Twitch endpoints and auth worker
- [x] Secure token storage and revocation on logout
