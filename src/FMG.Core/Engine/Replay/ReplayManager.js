import { createGameState } from '../State/GameState';
import { restoreSnapshot } from '../State/StateSnapshot';

export const ReplayManager = (() => {
  let currentGameState;
  let initialSnapshot;
  let recordedActions = [];

  const initialize = (snapshot, gameStateFactory = createGameState) => {
    initialSnapshot = snapshot;
    currentGameState = restoreSnapshot(snapshot, gameStateFactory);
    recordedActions = []; // Clear any previous actions
  };

  const recordAction = (action) => {
    recordedActions.push(action);
    currentGameState.dispatch(action);
  };

  const replay = (gameStateFactory = createGameState) => {
    const replayedGameState = restoreSnapshot(initialSnapshot, gameStateFactory);
    recordedActions.forEach(action => {
      replayedGameState.dispatch(action);
    });
    return replayedGameState;
  };

  const getCurrentGameState = () => currentGameState;

  return { initialize, recordAction, replay, getCurrentGameState };
})();
