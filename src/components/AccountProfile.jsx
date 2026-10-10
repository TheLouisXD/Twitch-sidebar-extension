import { useI18n } from "../i18n-context.js"
import { formatAvatarUrl } from "../twitch.js"

export default function AccountProfile({ user, loading, error }) {
  const { t } = useI18n()

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
          {user?.avatar_data || user?.profile_image_url ? (
            <img
              className="settings-avatar"
              src={user?.avatar_data || formatAvatarUrl(user?.profile_image_url)}
              alt={user?.display_name ?? ""}
              decoding="async"
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
