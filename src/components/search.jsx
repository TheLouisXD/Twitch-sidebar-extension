import { useI18n } from "../i18n"
import "./search.css"

function search(liveChannels, offlineChannels, query) {
    const q = query.toLowerCase()
    const filteredLive = liveChannels.filter(
        (ch) => ch.user_name.toLowerCase().includes(q) || (ch.game_name ?? "").toLowerCase().includes(q)
    )
    const filteredOffline = offlineChannels.filter(
        (ch) => ch.user_name.toLowerCase().includes(q)
    )
    return { filteredLive, filteredOffline }
}

const SearchBar = ({ query, setQuery }) => {
    const { t } = useI18n()
    return (
        <div className="search-bar">
            <input
                className="search-bar-input"
                type="text"
                placeholder={t("search.placeholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
        </div>
    )
}

export { search, SearchBar }
