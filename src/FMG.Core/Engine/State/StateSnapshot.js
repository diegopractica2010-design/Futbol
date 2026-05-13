import { immutableClone } from '../../../Utils/immutableClone';

const SNAPSHOT_VERSION = 1;

export const createSnapshot = (gameState) => {
  const state = gameState.getState();
  return {
    version: SNAPSHOT_VERSION,
    state: immutableClone(state),
  };
};

export const restoreSnapshot = (snapshot, createGameStateFn) => {
  if (snapshot.version !== SNAPSHOT_VERSION) {
    console.warn(`Snapshot version mismatch. Expected ${SNAPSHOT_VERSION}, got ${snapshot.version}. Attempting to restore anyway.`);
  }
  // Assuming createGameStateFn can take an initial state to reconstruct
  return createGameStateFn(snapshot.state);
};
