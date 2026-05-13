import { deepFreeze } from '../../Utils/deepFreeze';

export class StateBuilder {
  constructor(initialState = {}) {
    this.state = deepFreeze(initialState);
  }

  // Method to set a new state, returning a new StateBuilder instance (immutability)
  setState(newState) {
    return new StateBuilder({ ...this.state, ...newState });
  }

  // Method to get the current immutable state
  getState() {
    return this.state;
  }
}