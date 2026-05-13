
export const updateManager = (state, payload) => {
  if (!payload.manager) {
    throw new Error("Manager required");
  }

  return state.with({
    manager: payload.manager,
    metadata: {
      ...state.metadata,
      lastManagerUpdate: new Date().toISOString()
    }
  });
};
