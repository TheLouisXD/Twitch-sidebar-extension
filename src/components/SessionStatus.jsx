import { useI18n } from "../i18n-context.js"
import "./SessionStatus.css"

export default function SessionStatus({ error, onRetry, onLogout }) {
  const { t } = useI18n()
  return (
    <div className="session-status">
      {error ? (
        <div className="session-recovery" role="alert">
          <p>{t("session.recovery")}</p>
          <button className="session-retry" onClick={onRetry}>
            {t("common.retry")}
          </button>
          <button className="session-reset" onClick={onLogout}>
            {t("settings.logout")}
          </button>
        </div>
      ) : (
        <div className="session-spinner" role="status" aria-label={t("main.loading")} />
      )}
    </div>
  )
}
