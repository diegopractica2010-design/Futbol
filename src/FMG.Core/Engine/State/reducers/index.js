import { updateClubs } from './clubsReducer';
import { updateSeason, advanceWeek, addMatchResult, updateStandings } from './seasonReducer';
import { updateManager } from './managerReducer';
import { applyWeeklyEffects } from './matchReducer';
import { updateMarket } from './marketReducer';
import { updatePlayer } from './playerReducer';

const reducers = {
  ADVANCE_WEEK: advanceWeek,
  UPDATE_CLUBS: updateClubs,
  UPDATE_SEASON: updateSeason,
  UPDATE_MANAGER: updateManager,
  ADD_MATCH_RESULT: addMatchResult,
  UPDATE_STANDINGS: updateStandings,
  APPLY_WEEKLY_EFFECTS: applyWeeklyEffects,
  UPDATE_MARKET: updateMarket,
  UPDATE_PLAYER: updatePlayer
};

export const rootReducer = (state, action) => {
  if (action.type === 'BATCH_UPDATE') {
    let newState = state;
    for (const a of action.payload.actions) {
      newState = rootReducer(newState, a);
    }
    return newState;
  }

  const reducer = reducers[action.type];
  if (reducer) {
    return reducer(state, action.payload);
  }
  
  console.warn("Unknown action type:", action.type);
  return state;
};
