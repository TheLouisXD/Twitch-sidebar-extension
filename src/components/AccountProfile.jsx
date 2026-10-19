import { useState } from "react"
import { useI18n } from "../i18n-context.js"
import { formatAvatarUrl } from "../twitch.js"

export default function AccountProfile({ user, loading, error }) {
  const { t } = useI18n()
  // The cached data URL is the preferred source for instant display, but if the
  // runtime blocks it (e.g. a stale manifest without `data:` in `img-src`), fall
  // back to the CDN avatar instead of leaving an empty frame.
  const [failedAvatars, setFailedAvatars] = useState(() => new Set())
  const avatarSrc =
    [user?.avatar_data, formatAvatarUrl(user?.profile_image_url)].find(
      (candidate) => candidate && !failedAvatars.has(candidate)
    ) ?? null

  if (loading && !user)
    return (
      <div className="settings-loading">
        <div className="settings-spinner" role="status" aria-label={t("main.loading")} />
      </div>
    )
  if (error && !user)
    return (
      <div className="main-error-banner" role="alert">
        {t("settings.error")}
      </div>
    )
  return (
    <>
      <div className="settings-profile">
        <div className="settings-avatar-wrap">
          {avatarSrc ? (
            <img
              className="settings-avatar"
              src={avatarSrc}
              alt={user?.display_name ?? ""}
              decoding="async"
              onError={() => setFailedAvatars((current) => new Set(current).add(avatarSrc))}
            />
          ) : (
            <div className="settings-avatar-placeholder" />
          )}
        </div>
        <span className="settings-username">{user?.display_name ?? "—"}</span>
        <span className="settings-login">@{user?.login ?? "—"}</span>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">{t("settings.account")}</div>
        <div className="settings-info-list">
          <div className="settings-info-item">
            <span className="settings-info-label">{t("settings.followers")}</span>
            <span className="settings-info-value">{user?.followers ?? "—"}</span>
          </div>
        </div>
      </div>
    </>
  )
}
