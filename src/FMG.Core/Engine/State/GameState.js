import { StateBuilder } from './StateBuilder';
import { immutableClone } from '../../Utils/immutableClone';
import { RNG } from '../Simulation/RNG';
import { ClubAggregate } from '../../Domain/Club/ClubAggregate';
import { SeasonAggregate } from '../../Domain/Season/SeasonAggregate';
import { ManagerAggregate } from '../../Domain/Manager/ManagerAggregate';
import { rootReducer } from './reducers';

export const createGameState = (initialState = {}) => {
  const defaultState = {
    clubs: {},
    season: {},
    managers: {},
    worldMetadata: {},
    simulationSeed: (new RNG(Date.now())).next(), // Use deterministic RNG
    ...initialState,
  };

  let stateBuilder = new StateBuilder(immutableClone(defaultState));

  const getState = () => stateBuilder.getState();

  const dispatch = (action) => {
    const newState = rootReducer(getState(), action);
    stateBuilder = stateBuilder.setState(newState);
  };

  // Initialize aggregates (minimal representation)
  Object.keys(defaultState.clubs).forEach(clubId => {
    ClubAggregate(defaultState.clubs[clubId]);
  });
  SeasonAggregate(defaultState.season);
  Object.keys(defaultState.managers).forEach(managerId => {
    ManagerAggregate(defaultState.managers[managerId]);
  });

  return { getState, dispatch };
};
