import { useI18n } from "../i18n-context.js"

export default function AccountProfile({ user, loading, error }) {
  const { t, lang } = useI18n()
  function formatDate(isoDate) {
    if (!isoDate) return "—"
    return new Date(isoDate).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  if (loading)
    return (
      <div className="settings-loading">
        <div className="settings-spinner" role="status" aria-label={t("main.loading")} />
      </div>
    )
  if (error)
    return (
      <div className="main-error-banner" role="alert">
        {t("settings.error")}
      </div>
    )
  return (
    <>
      <div className="settings-profile">
        <div className="settings-avatar-wrap">
          {user?.profile_image_url ? (
            <img className="settings-avatar" src={user.profile_image_url} alt={user.display_name} />
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
          <div className="settings-info-item">
            <span className="settings-info-label">{t("settings.type")}</span>
            <span className="settings-info-value">
              {user?.broadcaster_type === "partner"
                ? t("settings.partner")
                : user?.broadcaster_type === "affiliate"
                  ? t("settings.affiliate")
                  : t("settings.standard")}
            </span>
          </div>
          <div className="settings-info-item">
            <span className="settings-info-label">{t("settings.created")}</span>
            <span className="settings-info-value">{formatDate(user?.created_at)}</span>
          </div>
        </div>
      </div>
    </>
  )
}
