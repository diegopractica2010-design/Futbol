export const ClubAggregate = (initialState = {}) => {
  let state = Object.freeze(initialState);

  const applyEvent = (event) => {
    // In a real scenario, this would apply event to state
    state = Object.freeze({ ...state, ...event });
  };

  const getState = () => state;

  return { applyEvent, getState };
};