# FMG.Core Architecture & Migration

## Overview

FMG.Core is the new deterministic simulation engine for Football Manager Game. It replaces legacy simulation logic with immutable, testable aggregates.

## Directory Structure

```
src/FMG.Core/
├── Utils/                      # Utility functions
│   └── RNG.js                 # Seedable PRNG
├── Events/
│   └── EventBus.js            # Deterministic event system
├── Domain/                      # Domain aggregates (DDD)
│   ├── Club/
│   │   ├── ClubAggregate.js   # Club aggregate root
│   │   └── index.js
│   ├── Season/
│   │   ├── SeasonAggregate.js # Season aggregate root
│   │   └── index.js
│   ├── Manager/
│   │   ├── ManagerAggregate.js # Manager aggregate root
│   │   └── index.js
│   ├── Match/
│   │   ├── MatchRecord.js      # Match entity
│   │   └── index.js
│   ├── Player/
│   │   ├── PlayerEntity.js     # Player entity
│   │   └── index.js
│   ├── Market/
│   │   ├── MarketAggregate.js  # Market aggregate root
│   │   └── index.js
│   └── Aggregates.js           # Barrel export (backward compat)
├── Engine/
│   ├── StateBuilder.js         # Immutable GameState construction
│   └── SimulationEngine.js     # Match & season simulation
├── Services/
│   └── MatchSimulator.js       # Deterministic match engine
├── Repository/                  # Persistence layer
│   ├── GameStateRepository.js  # Full game save/load
│   ├── SeasonRepository.js     # Season persistence
│   └── ClubRepository.js       # Club persistence
├── Adapters/
│   └── LegacyGameStateAdapter.js # Bridge to legacy FMG.gameState
└── index.js                     # Initialization & public API
```

## Script Loading Order

**CRITICAL**: Scripts must be loaded in this exact sequence:

1. RNG.js (utilities first)
2. EventBus.js (event system)
3. Domain aggregates (Club, Season, Manager, Match, Player, Market)
4. Aggregates.js (barrel)
5. StateBuilder.js & SimulationEngine.js (engine)
6. MatchSimulator.js (services)
7. Repository layer (GameStateRepository, SeasonRepository, ClubRepository)
8. LegacyGameStateAdapter.js (adapters)
9. index.js (initialization)

See `LOADING_ORDER.FMG_CORE.html` for the complete HTML script tag sequence.

## Core Concepts

### Immutability
All aggregates are immutable. Mutations return new instances:

```javascript
const club2 = club1.withSquad(newSquad);  // Returns new Club
const season2 = season1.nextWeek();       // Returns new Season
```

### Deterministic Simulation
Match results are deterministic from seed:

```javascript
const seed = FMG.Core.Utils.deriveSeed(baseSeed, weekIndex);
const result = matchSimulator.run(homeTeam, awayTeam, homeSquad, awaySquad, seed);
// Same seed + input = same output (always)
```

### Event-Driven
All state changes emit immutable events:

```javascript
eventBus.on(FMG.Core.Events.EventTypes.MATCH_COMPLETED, (event) => {
  console.log(event.payload.matchResult);
});
```

### Repository Pattern
Persistence is decoupled from domain logic:

```javascript
const repository = new FMG.Core.Repository.GameStateRepository();
await repository.save("save1", gameState);
const loaded = await repository.load("save1");
```

### Adapter Pattern
Legacy state is bridged via anti-corruption layer:

```javascript
const adapter = new FMG.Core.Adapters.LegacyGameStateAdapter();
const coreState = adapter.toCore();        // Legacy → Core
adapter.syncFromCore(coreState);           // Core → Legacy
```

## Usage Example

```javascript
// Initialize Core
FMG.Core.initialize({
  // optional config
});

// Get legacy state into Core
const adapter = FMG.Core.adapter;
let gameState = adapter.toCore();

// Advance week
const result = FMG.Core.engine.advanceWeek(gameState, {
  weekSeed: 12345
});

// Use new state
gameState = result.gameState;
const events = result.events;

// Sync back to legacy
adapter.syncFromCore(gameState);
```

## Determinism & Reproducibility

The RNG utilities provide deterministic seeding:

```javascript
// Same base seed + index = same derived seed
const seed1 = FMG.Core.Utils.deriveSeed(1000, 5);
const seed2 = FMG.Core.Utils.deriveSeed(1000, 5);
// seed1 === seed2 (always)

// String to seed hash
const stringSeed = FMG.Core.Utils.hashSeed("Chelsea vs Liverpool");
```

## Testing

All aggregates and engine are fully testable:

```javascript
// Create test state
const testClub = new FMG.Core.Domain.Club.ClubAggregate({
  teamId: 1,
  name: "Test Club",
  squad: [/* players */]
});

// Verify immutability
const updated = testClub.withFinances({ balance: 1000 });
console.assert(testClub.finances.balance !== updated.finances.balance);
```

## Migration Status

✅ **Complete**
- Aggregates extracted to subdirectories
- Deterministic simulation proven
- Event system fully synchronous
- Repository layer functional
- Legacy adapter bidirectional
- All tests passing (19/19)

⚠️ **Pending** (not in scope)
- Full IndexedDB support (localStorage works)
- Phases 18-24 extended tests
- Performance optimization
- Multiplayer sync protocol

## Files Modified in This Migration

```
src/FMG.Core/Domain/Club/ClubAggregate.js (NEW)
src/FMG.Core/Domain/Season/SeasonAggregate.js (NEW)
src/FMG.Core/Domain/Manager/ManagerAggregate.js (NEW)
src/FMG.Core/Domain/Match/MatchRecord.js (NEW)
src/FMG.Core/Domain/Player/PlayerEntity.js (NEW)
src/FMG.Core/Domain/Market/MarketAggregate.js (NEW)
src/FMG.Core/Domain/Aggregates.js (UPDATED - barrel export)
src/FMG.Core/Repository/GameStateRepository.js (NEW)
src/FMG.Core/Repository/SeasonRepository.js (NEW)
src/FMG.Core/Repository/ClubRepository.js (NEW)
src/FMG.Core/index.js (UPDATED - dependency check)
LOADING_ORDER.FMG_CORE.html (NEW - script sequence)
```
