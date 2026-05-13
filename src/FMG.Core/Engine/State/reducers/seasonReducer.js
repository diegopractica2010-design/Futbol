
export const updateSeason = (state, payload) => {
  if (!payload.season) {
    throw new Error("Season required");
  }

  return state.with({
    season: payload.season,
    metadata: {
      ...state.metadata,
      lastSeasonUpdate: new Date().toISOString()
    }
  });
};

export const advanceWeek = (state, payload) => {
  if (!state.season) {
    throw new Error("Season required to advance week");
  }

  const newSeason = state.season.nextWeek();
  return state.with({
    season: newSeason,
    timestamp: new Date().toISOString()
  });
};

export const addMatchResult = (state, payload) => {
  if (!payload.matchResult) {
    throw new Error("MatchResult required");
  }

  const newSeason = state.season.addMatchResult(payload.matchResult);
  return state.with({
    season: newSeason
  });
};

export const updateStandings = (state, payload) => {
  if (!Array.isArray(payload.standings)) {
    throw new Error("Standings must be array");
  }

  const newSeason = state.season.withStandings(payload.standings);
  return state.with({
    season: newSeason
  });
};
