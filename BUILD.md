# Reproducible browser extension builds

## Requirements

- Node.js 20.19+ on the 20.x branch, or Node.js 22.12+.
- npm and the committed `package-lock.json`.

```sh
npm ci
npm run lint
npm test
npm run build:firefox
```

Use `npm run build:chrome` for Chrome or `npm run build:all` for both. The outputs are `dist-firefox/` and `dist-chrome/`. The existing release/source ZIPs are older snapshots and are not updated by the build.

## Build process

Vite bundles the React panel using the corresponding JavaScript target (`firefox115` or `chrome116`). A second Vite library build compiles `src/background.js` and its shared modules into a standalone classic IIFE named `background.js`, without external module imports. It works both as a Firefox background script and as a Chrome service worker. The build copies `manifests/manifest.<browser>.json` to the output root. Unsupported `BROWSER_TARGET` values fail immediately.

`public/` contains static assets only. There is no second background implementation or duplicate public manifest to keep synchronized.

## Validation

The 47-test regression suite includes both Firefox Promise APIs and Chrome callbacks, OAuth state/redirect rejection, concurrent refreshes and notification preference changes, restart restoration, logout while refreshing, transient HTTP errors, complete stream/follow pagination and expired profile caches. It also checks refreshing a fresh cached list on opening, scheduled updates without a panel, badge restoration, configurable alarm replacement and restart persistence, interval validation, and stable live-favorite sorting based on bell preferences. HTTP responses and browser APIs are simulated in automated tests; these do not replace a successful OAuth login against Twitch.

Firefox 115 is the declared minimum because [storage.session became available in Firefox 115](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session). Chrome 116 is the minimum for [sidePanel.open](https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-open). Firefox uses `sidebar_action` and `background.scripts`; Chrome uses `side_panel` and `background.service_worker`. Native function arity is never used to choose callback or Promise behavior.

A separate Firefox compatibility reviewer loaded the generated extension into installed Firefox 157.0.1 with a temporary profile in headless mode. It checked installation, declared sidebar panel, background messaging and redirect, the API adapter, local/session storage, badge, three-minute alarm, concurrent notification preferences, React login rendering, language persistence, and OAuth popup cancellation/error recovery. No user profile was modified.

The compatibility refactor passed 13 live Firefox checks. The login layout at 320×500 pixels has no horizontal overflow and remains vertically scrollable. Raw observations are saved in [verification/firefox-report.json](verification/firefox-report.json); the corresponding asset names, background hash, linter result and test limits are in [verification/firefox-build.json](verification/firefox-build.json). That hash matched the generated package for that phase; the reports are historical snapshots.

The subsequent avatar reflection change passed four focused checks in Firefox 157 using panel assets `index-BTFsJFqt.js` and `index-CneephnZ.css`. The same avatar is flipped vertically, softly blurred, and masked from 100% opacity at the top to 0% at the bottom. The reflection is decorative and does not intercept bell clicks. Offline cards keep their grayscale appearance. See [the raw results](verification/firefox-ambient-report.json) and [the unmodified screenshot with local test images](verification/firefox-ambient.png). Lint and both browser builds pass for this change; the background hash remains unchanged.

The configurable refresh and live-favorite changes passed ten focused checks in real Firefox 157.0.1 with simulated Twitch responses. The reviewer exercised all eight intervals against native Firefox alarms, preference persistence when reopening the panel, polling with both panels closed, cache/badge changes to zero, search with one or no results, bell-based sorting, and both settings and the list at 320 pixels without horizontal overflow. The current build's asset names and background hash are recorded in [verification/firefox-preferences-build.json](verification/firefox-preferences-build.json). See [the results](verification/firefox-preferences-report.json), [settings and favorite order](verification/firefox-preferences.png), and [search with the total live count](verification/firefox-search-total.png). ESLint, all 47 automated tests, both builds and the Firefox package lint pass (the four known package warnings below remain).

`web-ext lint` reports no errors. Four warnings remain: two React runtime `innerHTML` checks and two version notices for the data-consent manifest key (native support starts in Firefox 140 desktop / 142 Android). That metadata does not lower the runtime minimum of the APIs used by the desktop extension; older versions ignore it.

An authenticated OAuth success, the Twitch application's registered redirect list, delivery of native OS notifications, a physical toolbar click, and Firefox 115 itself require additional manual verification. The automated suite checks the corresponding logic. Chrome was verified by build and simulated API tests, not by a live Chrome session.

The Firefox redirect observed for the fixed Gecko ID is documented in README.md. [Twitch requires the registered redirect and recommends validating state](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow). The full authentication flow runs in the background so the sidebar can close without interrupting token persistence.

## Firefox distribution

The manifest declares required `authenticationInfo` and `personallyIdentifyingInfo` data types because OAuth credentials are sent to the authentication Worker and the account ID is sent to Twitch. This categorization follows the actual requests and [Mozilla's taxonomy](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/); it is not a declaration of analytics or browsing-history collection.

The login panel explains transmission before sign-in. Firefox versions predating Mozilla's native data consent need a custom consent experience meeting Mozilla's publishing policy if distributed through AMO; publication targeting those versions needs that additional work or a higher minimum version. The runtime compatibility checks do not constitute AMO publication approval.

## Worker validation

From `../twitch-auth-worker/`, run `npm ci`, `npm test` and `npx wrangler deploy --dry-run`. The Worker tests cover malformed JSON and field types, Firefox redirect/code exchange, refresh-token encoding, unavailable upstream responses, and CORS-enabled errors. The dry run bundles locally without deployment. Updating this service in production is a separate step; the extension retains the legacy request field needed by the currently deployed service.

Use Node.js 22.12+ for the installed Wrangler toolchain. The extension-only build also supports the Node.js 20 versions listed above.
