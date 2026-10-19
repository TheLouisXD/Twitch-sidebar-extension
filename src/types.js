/**
 * Twitch field names intentionally retain the API's snake_case.
 * UI preferences use camelCase; conversion happens at the API boundary.
 * @typedef {object} Channel
 * @property {string} user_id
 * @property {string} user_login
 * @property {string} user_name
 * @property {string|null} [profile_image_url]
 * @property {string|null} [game_name]
 * @property {number|null} [viewer_count]
 * @property {boolean} isLive
 *
 * @typedef {object} ChannelList
 * @property {Channel[]} live
 * @property {Channel[]} offline
 *
 * @typedef {object} Preferences
 * @property {number} pollIntervalMinutes
 * @property {boolean} rememberSession
 * @property {"default"|"gx"} theme
 * @property {AccentColor|null} accentColor
 *
 * @typedef {"red"|"blue"|"purple"|"yellow"|"orange"|"green"|"sky"} AccentColor
 *
 * @typedef {object} TwitchCardProps
 * @property {Channel} channel
 * @property {boolean} isLive
 * @property {boolean} [isNotified]
 * @property {(login: string) => void} onClick
 * @property {(broadcasterId: string) => Promise<void>|void} [onToggleNotify]
 *
 * @typedef {{type: "SESSION_RESTORE"|"SESSION_LOGOUT"|"TWITCH_AUTH"|"GET_PROFILE"|"LOAD_CHANNELS"|"POLL_NOW"}
 * | {type: "SET_POLL_INTERVAL", minutes: number}
 * | {type: "SET_REMEMBER_SESSION", enabled: boolean}
 * | {type: "TOGGLE_NOTIFICATION"|"REMOVE_NOTIFICATION", broadcasterId: string}} ExtensionMessage
 */
export {}
