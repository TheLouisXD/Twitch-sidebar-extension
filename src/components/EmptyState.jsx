import "./EmptyState.css"

export default function EmptyState({ icon, message, hint }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p className="empty-state-text">{message}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
    </div>
  )
}
