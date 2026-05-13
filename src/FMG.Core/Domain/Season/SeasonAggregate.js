import { immutableClone, deepFreeze } from '../../Utils/immutableClone';

export const SeasonAggregate = (initialState = {}) => {
  let state = immutableClone(initialState);

  const applyEvent = (event) => {
    // In a real scenario, this would apply event to state
    state = deepFreeze({ ...state, ...event });
  };

  const getState = () => state;

  return { applyEvent, getState };
};