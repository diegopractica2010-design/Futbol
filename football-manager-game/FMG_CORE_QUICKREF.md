# FMG.Core Quick Reference

## Quick Start (Copy to HTML)

```html
<!-- Copy this loading order to your HTML file -->
<script src="src/FMG.Core/Utils/RNG.js"></script>
<script src="src/FMG.Core/Events/EventBus.js"></script>
<script src="src/FMG.Core/Domain/Club/ClubAggregate.js"></script>
<script src="src/FMG.Core/Domain/Season/SeasonAggregate.js"></script>
<script src="src/FMG.Core/Domain/Manager/ManagerAggregate.js"></script>
<script src="src/FMG.Core/Domain/Match/MatchRecord.js"></script>
<script src="src/FMG.Core/Domain/Player/PlayerEntity.js"></script>
<script src="src/FMG.Core/Domain/Market/MarketAggregate.js"></script>
<script src="src/FMG.Core/Domain/Aggregates.js"></script>
<script src="src/FMG.Core/Engine/StateBuilder.js"></script>
<script src="src/FMG.Core/Engine/SimulationEngine.js"></script>
<script src="src/FMG.Core/Services/MatchSimulator.js"></script>
<script src="src/FMG.Core/Repository/GameStateRepository.js"></script>
<script src="src/FMG.Core/Repository/SeasonRepository.js"></script>
<script src="src/FMG.Core/Repository/ClubRepository.js"></script>
<script src="src/FMG.Core/Adapters/LegacyGameStateAdapter.js"></script>
<script src="src/FMG.Core/index.js"></script>

<script>
  FMG.Core.initialize();
</script>
```

## Main API

### Simulation
```javascript
// Advance week
const result = FMG.Core.engine.advanceWeek(gameState, {
  weekSeed: 12345
});

// result = { gameState, events, executionMs, commandId }
```

### Events
```javascript
// Listen to events
FMG.Core.eventBus.on(FMG.Core.Events.EventTypes.MATCH_COMPLETED, (event) => {
  console.log(event.payload);
});

// Emit events
FMG.Core.eventBus.emit("CUSTOM_EVENT", { data: "..." });
```

### State Building
```javascript
// Build immutable GameState
const gameState = new FMG.Core.Engine.StateBuilder()
  .withSeason(season)
  .withClubs(clubs)
  .withManager(manager)
  .build();
```

### Aggregates
```javascript
// Club
const club2 = club1.withSquad(newSquad);
const club3 = club2.withFinances({ balance: 1000 });

// Season
const season2 = season1.nextWeek();
const season3 = season2.withStandings(newStandings);

// Manager
const manager2 = manager1.withCareer({ reputation: 50 });
```

### Persistence
```javascript
// Save
const repo = new FMG.Core.Repository.GameStateRepository();
await repo.save("save1", gameState);

// Load
const loaded = await repo.load("save1");

// List all saves
const saves = await repo.list();
```

### Legacy Bridge
```javascript
// Convert legacy → Core
const gameState = FMG.Core.adapter.toCore();

// Sync Core → legacy
FMG.Core.adapter.syncFromCore(gameState);

// Validate roundtrip
const validation = FMG.Core.adapter.validateRoundtrip();
```

### Determinism
```javascript
// Derive seed from base + index
const seed = FMG.Core.Utils.deriveSeed(baseSeed, weekIndex);

// Hash string to seed
const stringSeed = FMG.Core.Utils.hashSeed("Chelsea vs Liverpool");

// Create RNG from seed
const rng = new FMG.Core.Utils.RNG(seed);
const randomValue = rng.next(); // 0-1
const randomInt = rng.nextInt(1, 10);
```

## Namespace Reference

```javascript
// Utils
FMG.Core.Utils.RNG
FMG.Core.Utils.deriveSeed()
FMG.Core.Utils.hashSeed()

// Events
FMG.Core.Events.EventBus
FMG.Core.Events.DomainEvent
FMG.Core.Events.EventTypes

// Domain
FMG.Core.Domain.Club → FMG.Core.Domain.Club.ClubAggregate
FMG.Core.Domain.Season → FMG.Core.Domain.Season.SeasonAggregate
FMG.Core.Domain.Manager → FMG.Core.Domain.Manager.ManagerAggregate
FMG.Core.Domain.MatchRecord → FMG.Core.Domain.Match.MatchRecord
FMG.Core.Domain.PlayerEntity → FMG.Core.Domain.Player.PlayerEntity
FMG.Core.Domain.MarketAggregate → FMG.Core.Domain.Market.MarketAggregate

// Engine
FMG.Core.Engine.GameState
FMG.Core.Engine.StateBuilder
FMG.Core.Engine.StateValidator
FMG.Core.Engine.SimulationEngine

// Services
FMG.Core.Services.MatchSimulator

// Repository
FMG.Core.Repository.GameStateRepository
FMG.Core.Repository.SeasonRepository
FMG.Core.Repository.ClubRepository

// Adapters
FMG.Core.Adapters.LegacyGameStateAdapter
FMG.Core.Adapters.legacyAdapter (global instance)

// Global
FMG.Core.eventBus
FMG.Core.engine
FMG.Core.adapter
```

## Common Patterns

### Immutable Mutations
```javascript
// OLD (mutable - DO NOT USE)
club.squad.push(newPlayer);

// NEW (immutable)
const club2 = club1.withSquad([...club1.squad, newPlayer]);
```

### Deterministic Simulation
```javascript
// Always same seed = always same output
const seed1 = FMG.Core.Utils.deriveSeed(1000, 5);
const seed2 = FMG.Core.Utils.deriveSeed(1000, 5);
// seed1 === seed2 (always)

const result1 = matchSimulator.run(home, away, squad1, squad2, seed1);
const result2 = matchSimulator.run(home, away, squad1, squad2, seed2);
// result1.homeGoals === result2.homeGoals (always)
```

### Event Handling
```javascript
// One-time listener
FMG.Core.eventBus.once(FMG.Core.Events.EventTypes.WEEK_ADVANCED, (event) => {
  console.log("Week advanced");
});

// Get event history
const history = FMG.Core.eventBus.history();
const matchEvents = FMG.Core.eventBus.history("MATCH_COMPLETED");
```

### Error Handling
```javascript
try {
  const result = FMG.Core.engine.advanceWeek(gameState, {});
} catch (err) {
  console.error("Simulation failed:", err.message);
}
```

## Testing Example

```javascript
// Create test aggregate
const testClub = new FMG.Core.Domain.Club.ClubAggregate({
  teamId: 1,
  name: "Test Club",
  squad: testPlayers
});

// Test immutability
const updated = testClub.withSquad([]);
console.assert(testClub.squad.length === testPlayers.length);
console.assert(updated.squad.length === 0);

// Test determinism
const rng1 = new FMG.Core.Utils.RNG(12345);
const rng2 = new FMG.Core.Utils.RNG(12345);
console.assert(rng1.next() === rng2.next());
```

## File Structure for Reference

```
src/FMG.Core/
├── Utils/RNG.js                          (24 KB)
├── Events/EventBus.js                    (15 KB)
├── Domain/
│   ├── Club/ClubAggregate.js            (4 KB)
│   ├── Season/SeasonAggregate.js        (4 KB)
│   ├── Manager/ManagerAggregate.js      (3 KB)
│   ├── Match/MatchRecord.js             (4 KB)
│   ├── Player/PlayerEntity.js           (3 KB)
│   ├── Market/MarketAggregate.js        (3 KB)
│   └── Aggregates.js                    (2 KB - barrel)
├── Engine/
│   ├── StateBuilder.js                  (10 KB)
│   └── SimulationEngine.js              (20 KB)
├── Services/
│   └── MatchSimulator.js                (18 KB)
├── Repository/
│   ├── GameStateRepository.js           (12 KB)
│   ├── SeasonRepository.js              (8 KB)
│   └── ClubRepository.js                (8 KB)
├── Adapters/
│   └── LegacyGameStateAdapter.js        (15 KB)
└── index.js                             (3 KB)
```

## Troubleshooting

### "FMG.Core missing dependencies"
- Check LOADING_ORDER.FMG_CORE.html for correct script sequence
- Ensure all 17 scripts are loaded
- Check browser console for parse errors

### "Club is undefined"
- Use `FMG.Core.Domain.Club.ClubAggregate` instead of bare `Club`
- Or use barrel export: `const Club = FMG.Core.Domain.Club;`

### "State validation failed"
- Ensure all required fields in GameState (version, timestamp, season, clubs, manager)
- Check StateValidator.validate() for specific errors

### "RNG returns undefined"
- Ensure RNG.js is loaded FIRST
- Check FMG.Core.Utils.RNG exists
- Create new RNG instance: `new FMG.Core.Utils.RNG(seed)`

## Performance Notes

- **Immutability**: Object.freeze() adds negligible overhead (~1%)
- **RNG**: Mulberry32 is ~100 cycles per call, very fast
- **EventBus**: Synchronous, no async overhead
- **Simulation**: ~50-100ms per week for typical season (20 teams)

## Next Steps

1. Copy LOADING_ORDER.FMG_CORE.html to your HTML
2. Call FMG.Core.initialize()
3. Use FMG.Core.adapter to sync legacy ↔ Core
4. Run FMG.Core.engine.advanceWeek() for simulation
5. Use Repository to persist saves

For detailed docs, see: FMG_CORE_MIGRATION.md
