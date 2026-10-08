import { useI18n } from "../i18n-context.js"
import "./SearchBar.css"

const SearchBar = ({ query, setQuery }) => {
  const { t } = useI18n()
  return (
    <div className="search-bar">
      <input
        className="search-bar-input"
        type="text"
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  )
}

export { SearchBar }
