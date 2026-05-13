export const rootReducer = (state, action) => {
  // This is a placeholder for the actual root reducer logic.
  // In a real scenario, this would combine multiple sub-reducers.
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload };
    default:
      return state;
  }
};
