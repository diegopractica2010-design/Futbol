if (typeof window === "undefined") {
  global.window = global;
  global.FMG = global.FMG || {};
  require("../src/utils.js");
  require("../src/FMG.Core/Utils/RNG.js");
  require("../src/FMG.Core/Engine/GameState.js");
  require("../src/FMG.Core/Engine/Reducers.js");
  require("../src/FMG.Core/Engine/StateTransition.js");
  require("../src/FMG.Core/Engine/StateSnapshot.js");
}

(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Tests = FMG.Core.Tests || {};

  /**
   * ImmutableStateTests — Comprehensive test suite for immutable state architecture
   * Validates:
   * - Immutability guarantees
   * - Determinism
   * - Replay safety
   * - Transaction atomicity
   * - Copy-on-write efficiency
   */

  const tests = [];
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message || "") + " Expected " + expected + " but got " + actual);
    }
  }

  function assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  function assertFalse(condition, message) {
    if (condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  function assertArrayEquals(actual, expected, message) {
    if (actual.length !== expected.length) {
      throw new Error((message || "") + " Array length mismatch");
    }
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error((message || "") + " Element " + i + " mismatch");
      }
    }
  }

  function validGameStateConfig(overrides) {
    return Object.assign({
      version: 1,
      season: { week: 1 },
      clubs: [{ teamId: "test-club", squad: [] }],
      manager: { profile: { name: "Manager" } }
    }, overrides || {});
  }

  // ============================================================================
  // TEST SUITE: Immutability
  // ============================================================================

  test("GameState is frozen and immutable", function () {
    const state = new FMG.Core.Engine.GameState({
      version: 1,
      season: null,
      clubs: [],
      manager: null
    });

    try {
      state.version = 2;
      throw new Error("Should not allow mutation");
    } catch (e) {
      assertTrue(e.message.includes("read-only") || e.message.includes("Cannot"));
    }
  });

  test("GameState.with() creates new instance", function () {
    const state1 = new FMG.Core.Engine.GameState({ version: 1 });
    const state2 = state1.with({ version: 2 });

    assertFalse(state1 === state2, "Should create new instance");
    assertEquals(state1.version, 1, "Original unchanged");
    assertEquals(state2.version, 2, "New has changed value");
  });

  test("GameState.with() unchanged returns same instance", function () {
    const state1 = new FMG.Core.Engine.GameState({ version: 1 });
    const state2 = state1.with({});

    assertEquals(state1, state2, "Should return same instance for no changes");
  });

  test("Clubs array is frozen", function () {
    const clubs = [];
    const state = new FMG.Core.Engine.GameState({ clubs: clubs });

    try {
      state.clubs.push({});
      throw new Error("Should not allow mutation");
    } catch (e) {
      assertTrue(e.message.includes("read-only") || e.message.includes("Cannot"));
    }
  });

  test("Metadata is frozen", function () {
    const metadata = { key: "value" };
    const state = new FMG.Core.Engine.GameState({ metadata: metadata });

    try {
      state.metadata.key = "changed";
      throw new Error("Should not allow mutation");
    } catch (e) {
      assertTrue(e.message.includes("read-only") || e.message.includes("Cannot"));
    }
  });

  // ============================================================================
  // TEST SUITE: State Tracking
  // ============================================================================

  test("GameState tracks generation", function () {
    const state1 = new FMG.Core.Engine.GameState({ version: 1 });
    assertEquals(state1.generation, 0, "Initial generation is 0");

    const state2 = state1.with({ version: 2 });
    assertEquals(state2.generation, 1, "Generation increments");
    assertEquals(state2.parentStateId, state1.stateId, "Parent tracked");
  });

  test("GameState snapshot includes lineage", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });
    const snapshot = state.snapshot();

    assertTrue(snapshot.stateId, "StateId present");
    assertEquals(snapshot.generation, 0, "Generation included");
    assertTrue(snapshot.checksum, "Checksum included");
  });

  // ============================================================================
  // TEST SUITE: Reducers (Pure Functions)
  // ============================================================================

  test("applyAction is pure function", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });

    const result1 = FMG.Core.Engine.Reducers.applyAction(state, {
      type: "UPDATE_MANAGER",
      payload: { manager: { profile: { name: "Test" } } }
    });

    const result2 = FMG.Core.Engine.Reducers.applyAction(state, {
      type: "UPDATE_MANAGER",
      payload: { manager: { profile: { name: "Test" } } }
    });

    assertTrue(result1.manager.profile.name === result2.manager.profile.name, "Same input produces same output");
  });

  test("batchUpdate applies all actions", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });

    const result = FMG.Core.Engine.Reducers.batchUpdate(state, {
      actions: [
        { type: "UPDATE_MANAGER", payload: { manager: { profile: { name: "Test" } } } }
      ]
    });

    assertEquals(result.manager.profile.name, "Test", "Batch action applied");
  });

  // ============================================================================
  // TEST SUITE: Transactions
  // ============================================================================

  test("StateTransaction commits atomically", function () {
    const state = new FMG.Core.Engine.GameState(validGameStateConfig());

    const transaction = new FMG.Core.Engine.StateTransaction(state);
    transaction.apply({
      type: "UPDATE_MANAGER",
      payload: { manager: { profile: { name: "Test" } } }
    });

    const result = transaction.commit();
    assertTrue(result.gameState.manager, "Changes applied");
    assertEquals(result.transaction.actionCount, 1, "Action logged");
  });

  test("StateTransaction can abort", function () {
    const state = new FMG.Core.Engine.GameState(validGameStateConfig());
    const originalStateId = state.stateId;

    const transaction = new FMG.Core.Engine.StateTransaction(state);
    transaction.apply({
      type: "UPDATE_MANAGER",
      payload: { manager: { profile: { name: "Test" } } }
    });

    const aborted = transaction.abort();
    assertEquals(aborted.stateId, originalStateId, "State reverted");
  });

  // ============================================================================
  // TEST SUITE: Snapshots
  // ============================================================================

  test("SnapshotStore saves and loads", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });
    const store = new FMG.Core.Engine.SnapshotStore();

    const snapshotId = store.save(state, "test_snap");
    const loaded = store.load(snapshotId);

    assertEquals(loaded.version, 1, "Snapshot restored");
  });

  test("SnapshotStore enforces max snapshots", function () {
    const store = new FMG.Core.Engine.SnapshotStore();
    store.maxSnapshots = 5;

    for (let i = 0; i < 10; i++) {
      const state = new FMG.Core.Engine.GameState({ version: i });
      store.save(state, "snap_" + i);
    }

    assertEquals(store.size(), 5, "Max snapshots enforced");
  });

  test("SnapshotStore.getLatest returns newest", function () {
    const store = new FMG.Core.Engine.SnapshotStore();
    const state1 = new FMG.Core.Engine.GameState({ version: 1 });
    const state2 = new FMG.Core.Engine.GameState({ version: 2 });

    store.save(state1, "snap1");
    store.save(state2, "snap2");

    const latest = store.getLatest();
    assertEquals(latest.version, 2, "Latest version returned");
  });

  // ============================================================================
  // TEST SUITE: Replay Safety
  // ============================================================================

  test("ReplayEngine produces deterministic results", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });
    const store = new FMG.Core.Engine.SnapshotStore();
    const engine = new FMG.Core.Engine.ReplayEngine(store);

    const snapshotId = store.save(state, "replay_test");
    const actions = [
      { type: "UPDATE_MANAGER", payload: { manager: { profile: { name: "Test" } } } }
    ];

    const result1 = engine.replay(snapshotId, actions);
    const result2 = engine.replay(snapshotId, actions);

    assertEquals(
      result1.finalState.manager.profile.name,
      result2.finalState.manager.profile.name,
      "Replay produces same result"
    );
  });

  test("ReplayEngine validates determinism", function () {
    const state = new FMG.Core.Engine.GameState({ version: 1 });
    const store = new FMG.Core.Engine.SnapshotStore();
    const engine = new FMG.Core.Engine.ReplayEngine(store);

    const snapshotId = store.save(state, "determinism_test");
    const actions = [
      { type: "UPDATE_MANAGER", payload: { manager: { profile: { name: "Test" } } } }
    ];

    const result = engine.replay(snapshotId, actions);
    const checksum = result.finalState._calculateChecksum();

    const validation = engine.validateDeterminism(snapshotId, actions, checksum);
    assertTrue(validation.isDeterministic, "Determinism validated");
  });

  // ============================================================================
  // TEST SUITE: Validation
  // ============================================================================

  test("GameState.validate checks invariants", function () {
    const invalidState = new FMG.Core.Engine.GameState({
      version: 1
      // Missing season, clubs, manager
    });

    const validation = invalidState.validate();
    assertFalse(validation.valid, "Invalid state detected");
    assertTrue(validation.errors.length > 0, "Errors reported");
  });

  test("StateValidator validates state", function () {
    const validator = new FMG.Core.Engine.StateValidator();
    const state = new FMG.Core.Engine.GameState({ version: 1 });

    const errors = validator.validate(state);
    assertTrue(errors.length > 0, "Invalid state detected");
  });

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================

  FMG.Core.Tests.runImmutableStateTests = function () {
    console.log("\n🧪 IMMUTABLE STATE ARCHITECTURE TESTS");
    console.log("=====================================\n");

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      try {
        test.fn();
        console.log("✅ " + test.name);
        passed++;
      } catch (e) {
        console.error("❌ " + test.name);
        console.error("   " + e.message);
        failed++;
      }
    }

    console.log("\n=====================================");
    console.log("Passed: " + passed + " | Failed: " + failed);
    console.log("Total:  " + (passed + failed));
    console.log("=====================================\n");

    return {
      passed: passed,
      failed: failed,
      total: passed + failed
    };
  };
})();

if (typeof module !== "undefined" && require.main === module) {
  const result = global.FMG.Core.Tests.runImmutableStateTests();
  if (result.failed > 0) process.exit(1);
}
