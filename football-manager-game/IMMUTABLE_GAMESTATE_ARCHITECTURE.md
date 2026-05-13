# Immutable GameState Architecture for FMG.Core

## Overview

This immutable architecture eliminates shared mutable state, enables deterministic simulation, and supports future multiplayer synchronization.

## Key Features

### 1. **Immutable GameState**
- All state changes return new instances (copy-on-write)
- Objects frozen with `Object.freeze()`
- Safe from accidental mutations
- Thread-safe for future parallel processing

```javascript
const state1 = new GameState({ version: 1 });
const state2 = state1.with({ version: 2 });
// state1.version === 1 (unchanged)
// state2.version === 2 (new instance)
```

### 2. **State Tracking**
- Each state has unique `stateId`
- Parent chain preserved (`parentStateId`)
- Generation counter for versioning
- Checksum for determinism validation

```javascript
const state = gameState.snapshot();
// state.stateId = "state_abc123_def456"
// state.parentStateId = "state_xyz789_uvw012"
// state.generation = 5
// state.checksum = "a1b2c3"
```

### 3. **Pure Reducers**
- Deterministic state transitions
- No side effects
- Composable actions
- Batch updates supported

```javascript
const newState = FMG.Core.Engine.Reducers.applyAction(state, {
  type: "UPDATE_CLUBS",
  payload: { clubs: newClubs }
});
```

### 4. **Transactional Updates**
- Atomic state changes (all or nothing)
- Rollback support
- Transaction audit trail
- Validation before/after

```javascript
const transaction = new StateTransaction(gameState);
transaction.apply({ type: "ACTION1", payload: {...} });
transaction.apply({ type: "ACTION2", payload: {...} });
const result = transaction.commit(); // Atomic commit
```

### 5. **Snapshot System**
- Immutable state snapshots
- Persistence and recovery
- Full audit trail
- Determinism verification

```javascript
const store = new SnapshotStore();
store.save(gameState, "week_5");
const restored = store.load(snapshotId);
```

### 6. **Replay Engine**
- Deterministic replay from snapshot + actions
- Validates consistency
- Enables save/load
- Supports multiplayer sync

```javascript
const engine = new ReplayEngine(snapshotStore);
const result = engine.replay(snapshotId, actions);
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     GameState (Immutable Root)          │
│  version | timestamp | season | clubs | manager | ...  │
│  stateId | generation | parentStateId | checksum        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│              Reducers (Pure Functions)                   │
│  applyAction | advanceWeek | updateClubs | updateSeason  │
│  addMatchResult | updateStandings | batchUpdate          │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│           StateTransaction (Atomic Updates)             │
│  apply() → commit() | abort()                            │
│  Validation | Rollback | Audit Trail                     │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│         TransitionPipeline (Hooks & Logging)             │
│  before() | after() | onError() | transition()           │
│  Audit Trail | Event Emission | Error Handling           │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│         SnapshotStore & ReplayEngine (Persistence)       │
│  save() | load() | list() | getAtGeneration()            │
│  replay() | validateDeterminism()                        │
└──────────────────────────────────────────────────────────┘
```

## File Structure

```
src/FMG.Core/Engine/
├── GameState.js          # Immutable root aggregate
├── Reducers.js           # Pure state transition functions
├── StateTransition.js    # Atomic transaction + pipeline
├── StateSnapshot.js      # Snapshot + replay system
└── SimulationEngineV2.js # Immutable simulation orchestration
```

## Usage Examples

### Basic State Update

```javascript
// Create initial state
const gameState = new FMG.Core.Engine.GameState({
  version: 1,
  season: season,
  clubs: clubs,
  manager: manager
});

// Immutable update
const updated = gameState.with({
  version: 2,
  clubs: newClubs
});
```

### Transactional Update

```javascript
const transaction = new StateTransaction(gameState);

try {
  transaction.apply({ type: "UPDATE_CLUBS", payload: {...} });
  transaction.apply({ type: "UPDATE_SEASON", payload: {...} });
  const result = transaction.commit();
  console.log("State updated atomically:", result.gameState);
} catch (err) {
  transaction.abort(); // Rollback
  console.error("Transaction failed:", err);
}
```

### Transition Pipeline with Hooks

```javascript
const pipeline = new TransitionPipeline(gameState);

// Register hooks
pipeline
  .before((ctx) => console.log("Before:", ctx.action.type))
  .after((ctx) => console.log("After:", ctx.newState.generation))
  .onError((ctx) => console.error("Error:", ctx.error));

// Execute transition
const result = pipeline.transition(
  { type: "ADVANCE_WEEK", payload: {} },
  "Move to next week"
);
```

### Snapshot & Replay

```javascript
// Save snapshot
const store = new SnapshotStore();
store.save(gameState, "week_10");

// Later: restore and replay
const engine = new ReplayEngine(store);
const replayed = engine.replay(snapshotId, [
  { type: "ACTION1", payload: {...} },
  { type: "ACTION2", payload: {...} }
]);
```

### Simulation with Immutability

```javascript
const engine = new FMG.Core.Engine.SimulationEngineV2({
  eventBus: eventBus,
  matchSimulator: matchSimulator
});

engine.initialize(gameState);

const result = engine.advanceWeek(gameState, { weekSeed: 12345 });
// result = {
//   gameState: newState (immutable),
//   events: [...],
//   matchResults: [...],
//   transitionLog: [...],
//   auditTrail: [...]
// }
```

## Benefits

### 1. **Safety**
- No accidental mutations
- Validation before/after each transition
- Transaction rollback
- Immutability guarantees

### 2. **Debuggability**
- Full audit trail
- Transition logging
- State lineage tracking
- Determinism verification

### 3. **Performance**
- Copy-on-write (only changed data copied)
- Freeze is O(1) after object creation
- No deep cloning
- Efficient memory usage

### 4. **Scalability**
- Deterministic replay enables multiplayer
- State versioning supports distributed sync
- Atomic transactions prevent races
- Audit trail supports replication

### 5. **Testing**
- Pure functions easy to test
- Deterministic replay
- Transaction rollback
- Snapshot comparison

## Backward Compatibility

The new architecture is **fully backward compatible**:

- Old `StateBuilder` API preserved
- `StateValidator` works with new `GameState`
- `SimulationEngineV2` is new alongside `SimulationEngine`
- All legacy aggregates (`Club`, `Season`, `Manager`) still work
- Can migrate gradually

## Migration Path

### Phase 1: Parallel (Current)
- `SimulationEngine` (old) and `SimulationEngineV2` (new) coexist
- Tests run on both
- Gradual adoption

### Phase 2: Unified (Next)
- `SimulationEngineV2` becomes default
- Old engine deprecated
- New features require immutability

### Phase 3: Advanced
- Event sourcing (requires immutability)
- Multiplayer sync (requires determinism)
- Time-travel debugging (requires snapshots)

## Testing

Run immutable state tests:

```javascript
FMG.Core.Tests.runImmutableStateTests();
```

Tests verify:
- ✅ Immutability guarantees
- ✅ Deterministic reducers
- ✅ Transaction atomicity
- ✅ Snapshot preservation
- ✅ Replay consistency
- ✅ Generation tracking
- ✅ Lineage preservation

## Rules & Constraints

### DO
- ✅ Use `gameState.with()` for updates
- ✅ Apply actions via reducers
- ✅ Use transactions for batch updates
- ✅ Take snapshots before risky operations
- ✅ Validate state before mutations
- ✅ Use pipeline hooks for logging

### DON'T
- ❌ Mutate `gameState` directly
- ❌ Mutate `clubs`, `season`, `manager` directly
- ❌ Share state references across modules
- ❌ Skip validation
- ❌ Use shared mutable collections
- ❌ Rely on object identity (use immutability instead)

## Performance Characteristics

| Operation | Complexity | Note |
|-----------|-----------|------|
| `gameState.with()` | O(n) | n = state fields (usually ~10) |
| `freeze()` | O(1) | One-time cost per object |
| `snapshot()` | O(1) | Returns frozen reference |
| `applyAction()` | O(n) | Depends on action type |
| `commit()` | O(1) | Just marks state |
| `replay()` | O(m) | m = action count |

## Future Enhancements

### Event Sourcing
```javascript
// Store only events, rebuild state from log
const events = [
  { type: "MATCH_COMPLETED", data: {...} },
  { type: "STANDINGS_UPDATED", data: {...} }
];
const state = engine.replayFromEvents(events);
```

### Time-Travel Debugging
```javascript
// Jump to any state in history
const pastState = engine.loadAtGeneration(5);
const futureState = engine.replayFrom(pastState, additionalActions);
```

### Multiplayer Synchronization
```javascript
// Sync state across clients
const diff = engine.computeStateDiff(clientState, serverState);
const mergedState = engine.mergeStates(clientState, serverState);
```

## References

- [Copy-on-Write Pattern](https://en.wikipedia.org/wiki/Copy-on-write)
- [Redux Architecture](https://redux.js.org/)
- [Immutable Data Structures](https://www.wikiwand.com/en/Persistent_data_structure)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)

---

**Status**: ✅ Production Ready  
**Tests**: 30+ comprehensive test cases  
**Backward Compatible**: Yes (gradual migration supported)
