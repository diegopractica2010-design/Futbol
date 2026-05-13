
export const updateClubs = (state, payload) => {
  if (!Array.isArray(payload.clubs)) {
    throw new Error("Clubs must be array");
  }

  return state.with({
    clubs: payload.clubs,
    metadata: {
      ...state.metadata,
      lastClubsUpdate: new Date().toISOString()
    }
  });
};
