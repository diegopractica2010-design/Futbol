
export const applyWeeklyEffects = (state, payload) => {
  const effects = payload.effects || {};
  const newClubs = state.clubs.map((club) => {
    const clubEffects = effects[club.teamId];
    if (!clubEffects) return club;

    return club.withFinances({
      balance: clubEffects.finances ? club.finances.balance + clubEffects.finances : club.finances.balance
    });
  });

  return state.with({
    clubs: newClubs
  });
};
