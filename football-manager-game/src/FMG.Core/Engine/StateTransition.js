(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * StateTransaction — Atomic, auditable state transitions
   * Ensures consistency and replay-ability
   *
   * Features:
   * - Atomic (all or nothing)
   * - Auditable (transaction log)
   * - Replayable (deterministic)
   * - Reversible (snapshots before/after)
   */
  function StateTransaction(gameState) {
    if (!gameState) {
      throw new Error("GameState required");
    }

    this.gameState = gameState;
    this.startSnapshot = gameState.snapshot();
    this.actions = [];
    this.committed = false;
    this.aborted = false;
  }

  /**
   * Record action in transaction
   */
  StateTransaction.prototype.apply = function (action) {
    if (this.committed || this.aborted) {
      throw new Error("Transaction already finalized");
    }

    if (!action || !action.type) {
      throw new Error("Action with type required");
    }
    if (FMG.runtimeMutationGuard) {
      FMG.runtimeMutationGuard.record("FMG.Core.action." + action.type, { system: "FMG.Core" });
    }

    // Apply action to current state
    const Reducers = FMG.Core.Engine.Reducers;
    const newState = Reducers.applyAction(this.gameState, action);

    // Validate new state
    const validation = newState.validate();
    if (!validation.valid) {
      throw new Error("State validation failed: " + validation.errors.join("; "));
    }

    this.gameState = newState;
    this.actions.push({
      type: action.type,
      payload: action.payload,
      timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(this.gameState.generation, this.actions.length + 10)
    });

    return this;
  };

  /**
   * Commit transaction
   * Returns final state and transaction metadata
   */
  StateTransaction.prototype.commit = function () {
    if (this.aborted) {
      throw new Error("Cannot commit aborted transaction");
    }

    this.committed = true;

    return {
      gameState: this.gameState,
      transaction: {
        startStateId: this.startSnapshot.stateId,
        endStateId: this.gameState.stateId,
        generation: this.gameState.generation,
        actionCount: this.actions.length,
        actions: this.actions,
        timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(this.gameState.generation, 50)
      }
    };
  };

  /**
   * Abort transaction and revert to original state
   */
  StateTransaction.prototype.abort = function () {
    this.aborted = true;
    this.gameState = FMG.Core.Engine.GameState.fromSnapshot(this.startSnapshot);
    return this.gameState;
  };

  /**
   * Get intermediate state without committing
   */
  StateTransaction.prototype.getState = function () {
    return this.gameState;
  };

  /**
   * Get transaction summary
   */
  StateTransaction.prototype.getSummary = function () {
    return {
      isCommitted: this.committed,
      isAborted: this.aborted,
      actionCount: this.actions.length,
      actions: this.actions,
      startStateId: this.startSnapshot.stateId,
      endStateId: this.gameState.stateId
    };
  };

  FMG.Core.Engine.StateTransaction = StateTransaction;

  /**
   * TransitionPipeline — Chain state transitions with hooks
   * Allows interception and validation
   */
  function TransitionPipeline(gameState) {
    this.gameState = gameState;
    this.hooks = {
      before: [],
      after: [],
      error: []
    };
    this.transitions = [];
  }

  /**
   * Register before-transition hook
   */
  TransitionPipeline.prototype.before = function (hook) {
    if (typeof hook !== "function") {
      throw new Error("Hook must be function");
    }
    this.hooks.before.push(hook);
    return this;
  };

  /**
   * Register after-transition hook
   */
  TransitionPipeline.prototype.after = function (hook) {
    if (typeof hook !== "function") {
      throw new Error("Hook must be function");
    }
    this.hooks.after.push(hook);
    return this;
  };

  /**
   * Register error handler hook
   */
  TransitionPipeline.prototype.onError = function (hook) {
    if (typeof hook !== "function") {
      throw new Error("Hook must be function");
    }
    this.hooks.error.push(hook);
    return this;
  };

  /**
   * Execute transition with hook pipeline
   */
  TransitionPipeline.prototype.transition = function (action, description) {
    try {
      // Execute before hooks
      const beforeContext = {
        currentState: this.gameState,
        action: action,
        description: description
      };

      for (let i = 0; i < this.hooks.before.length; i++) {
        this.hooks.before[i](beforeContext);
      }

      // Create transaction
      const transaction = new StateTransaction(this.gameState);
      transaction.apply(action);
      const result = transaction.commit();

      // Store new state
      this.gameState = result.gameState;
      this.transitions.push({
        action: action.type,
        description: description,
        timestamp: result.transaction.timestamp,
        transaction: result.transaction
      });

      // Execute after hooks
      const afterContext = {
        previousState: beforeContext.currentState,
        newState: this.gameState,
        action: action,
        description: description,
        transaction: result.transaction
      };

      for (let i = 0; i < this.hooks.after.length; i++) {
        this.hooks.after[i](afterContext);
      }

      return result;
    } catch (err) {
      // Execute error hooks
      const errorContext = {
        error: err,
        currentState: this.gameState,
        action: action
      };

      for (let i = 0; i < this.hooks.error.length; i++) {
        this.hooks.error[i](errorContext);
      }

      throw err;
    }
  };

  /**
   * Get current state
   */
  TransitionPipeline.prototype.getState = function () {
    return this.gameState;
  };

  /**
   * Get transition log
   */
  TransitionPipeline.prototype.getTransitionLog = function () {
    return this.transitions.slice();
  };

  /**
   * Clear transition log (but keep state)
   */
  TransitionPipeline.prototype.clearLog = function () {
    this.transitions = [];
    return this;
  };

  FMG.Core.Engine.TransitionPipeline = TransitionPipeline;
})();
