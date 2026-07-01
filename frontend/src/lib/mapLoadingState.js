const MAP_LOADING_KEYS = [
  'analysis',
  'competitors',
  'population',
  'competition-percentile',
  'h3-hexagons',
]

function hasMapLoading(loadingKeys) {
  return MAP_LOADING_KEYS.some((key) => loadingKeys.has(key))
}

module.exports = {
  MAP_LOADING_KEYS,
  hasMapLoading,
}
