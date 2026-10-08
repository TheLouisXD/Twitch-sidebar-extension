export function search(liveChannels, offlineChannels, query) {
  const q = query.trim().toLowerCase()
  const matchesName = (channel) => (channel.user_name ?? "").toLowerCase().includes(q)
  return {
    filteredLive: liveChannels.filter(
      (channel) => matchesName(channel) || (channel.game_name ?? "").toLowerCase().includes(q)
    ),
    filteredOffline: offlineChannels.filter(matchesName)
  }
}
