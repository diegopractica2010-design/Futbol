import { rootReducer } from './reducers';
import { immutableClone } from '../../Utils/immutableClone';

/**
 * Creates a transaction context for atomic state transitions.
 * @param {Object} baseState - The initial state to start the transaction from.
 * @returns {Object} A transaction object with add, commit, and rollback methods.
 */
export const createTransaction = (baseState) => {
  let workingState = immutableClone(baseState);
  const actions = [];
  let committed = false;

  return {
    /**
     * Queues an action to be applied during commit.
     * @param {Object} action - The action to be processed by the reducer.
     */
    add: (action) => {
      if (committed) throw new Error("Cannot add actions to a committed transaction");
      actions.push(action);
    },

    /**
     * Applies all queued actions atomically.
     * @returns {Object} The new state after applying all actions.
     * @throws {Error} If the transaction is already committed.
     */
    commit: () => {
      if (committed) throw new Error("Transaction already committed");
      
      // Atomic application of actions
      for (const action of actions) {
        workingState = rootReducer(workingState, action);
      }
      
      committed = true;
      return workingState;
    },

    /**
     * Discards all queued actions and aborts the transaction.
     */
    rollback: () => {
      if (committed) throw new Error("Cannot rollback a committed transaction");
      actions.length = 0;
    }
  };
};
