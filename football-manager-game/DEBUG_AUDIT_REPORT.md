# Football Manager Game - Full Deep Debug Audit

Date: 2026-05-16
Scope: full project architecture, FMG.Core, legacy runtime, browser execution, replay/snapshot systems, match simulation, persistence, UI, world systems, and scalability.

Important constraint honored: no fixes, no refactors, no gameplay logic modifications. This report is the only filesystem artifact created for this audit.

## 1. Executive Summary

Final stability score: 62 / 100

The project is playable in browser and the existing automated test suite passes. The current architecture has several healthy foundations: bounded event history, modular phase systems, save backup fallback, real browser boot, Core transaction hooks, snapshot restore, and replay primitives. However, the audit found serious risks in the FMG.Core-to-legacy bridge, long-term save growth, deterministic safety, and long-run scalability.

The most severe finding is that Core-routed week advancement can strip legacy team fields and erase player arrays after one Core week. This happens because `LegacyGameStateAdapter.fromCore()` serializes only a reduced team contract, and `SimulationEngine._autoSelectLineup()` expects `suspensionWeeks` while legacy players use `suspendedWeeks`; the strict filter can produce empty squads. This is dangerous for saves, player career expansion, replay trust, and long-term simulation.

## 2. Execution Evidence

### Existing Test Suite

Command:

```bash
npm test
```

Result: passed.

Coverage observed:

- Phase 0 through Phase 13 tests passed.
- Manager ecosystem tests passed.
- World media pressure tests passed.
- Advanced transfer market tests passed.
- Advanced youth academy tests passed.
- Squad psychology tests passed.
- Phase 15-17 smoke tests passed.
- Phase 19-23 tests passed.
- Phase 24 tests passed.
- Performance foundation tests passed.
- Phase 2 architecture tests passed.
- Stabilization diagnostics tests passed.

### Browser Runtime

Runtime: real Chrome headless through Chrome DevTools Protocol against `http://localhost:8080/?debug`.

Observed:

- Initial browser boot succeeded.
- `window.FMG` and `FMG.gameState` existed.
- Diagnostics layer existed.
- Onboarding -> club selection -> dashboard worked.
- 80 rapid route transitions completed without browser exceptions.
- 3 Core-routed `advanceWeek()` calls completed.
- Browser save/load cycle restored week correctly.
- No `Runtime.exceptionThrown` events were captured in the successful CDP probe.

### Long-Run Simulation Stress

10-season legacy simulation:

- Weeks processed: 260
- Time: 31.148 seconds
- Players grew from 254 to 399
- Save size after 10 seasons: 276,822 bytes
- Heap before GC at end: 121.22 MB
- Heap after GC: 16.77 MB

25-season legacy simulation:

- Weeks processed: 650
- Time: 94.174 seconds
- Players grew to 609
- Save size after 25 seasons: 4,636,682 bytes
- Heap after GC: 25.92 MB

50-season normal simulation:

- Did not complete normally.
- Stopped in season 3 because career status became `sacked`.
- Error: `startNewSeason Acepta una oferta antes de iniciar otra temporada.`

50-season forced-continuity scalability simulation:

- Intervention: reset `career.status` to `employed` only when blocked, for scalability measurement.
- Weeks processed: 1,300
- Time: 273.014 seconds
- Forced employment interventions: 5
- Players: 959
- Retired players retained: 675
- Save size: 7,495,177 bytes
- Heap after GC: 37.71 MB

### Large Database Simulation

Synthetic database:

- Teams: 66
- Players: 1,691
- Fixtures: 130
- Matches per week: 33

Observed:

- Initialization: 6,047 ms
- 10 weeks: 5,021 ms
- Average simulated week: 502.1 ms
- Save size after 10 weeks: 3,950,227 bytes
- Heap after GC: 22.2 MB

### Replay / Snapshot Tests

Core replay/snapshot probe:

- Initial snapshot count: 1
- Zero-action replay checksum: passed
- One-action `ADVANCE_WEEK` replay checksum: passed
- 200 repeated snapshot restores: passed
- Core `advanceWeek()` returned 6 match results and replay validation passed.

Repeated replay stress:

- 1,000 replay validations
- 50 actions per replay
- Failures: 0
- Total time: 311 ms

### Live Match / Playback Probe

Live match:

- First week was a user-club rest week.
- After one skipped week, live match started.
- Advanced to full time with 1-minute increments.
- Timeline reached 46 events.
- Finish live match succeeded.
- `matchState` returned to `idle`.
- 90-minute live simulation elapsed time: 28 ms in Node VM.

Phase16 listener lifecycle:

- 100 create/start/dispose cycles.
- Remaining resize listeners: 0.
- Errors: none.

## 3. Critical Issues Report

### CRITICAL-1: Core-routed week can erase legacy players

File: `src/FMG.Core/Engine/SimulationEngine.js`

System: FMG.Core week simulation / lineup preparation

Probable cause:

`_autoSelectLineup()` filters with `p.suspensionWeeks === 0`, while legacy players use `suspendedWeeks`. For legacy players, `p.suspensionWeeks` is `undefined`, so the available-player filter rejects every player. The method then writes `club.withSquad(Object.freeze(lineup))`, replacing the club squad with an empty array.

Reproduction:

1. Load full runtime.
2. Initialize game.
3. Select `colo-colo`.
4. Initialize `FMG.Core`.
5. Run one `FMG.advanceWeek()`.
6. Inspect `FMG.gameState.players`.

Observed:

- Before Core week: first player had 27 keys.
- After Core week: `FMG.gameState.players[0]` did not exist.
- All player keys were effectively missing.

Severity: CRITICAL

Long-term risk: save corruption, player career data loss, academy/world systems losing all player entities.

Replay impact: replay may validate a corrupted deterministic state because checksum is too weak.

Performance impact: short-term lower entity count hides corruption; long-term invalid state breaks systems.

Scalability impact: blocks massive world/player-career expansion.

### CRITICAL-2: Core-to-legacy adapter strips team fields

File: `src/FMG.Core/Adapters/LegacyGameStateAdapter.js:115-126`

System: FMG.Core adapter / persistence boundary

Probable cause:

`fromCore()` reconstructs legacy teams with only `id`, `name`, `budget`, `fanBase`, `form`, and `stadium`. It drops fields such as `city`, `style`, `sponsor`, and `infrastructureCost`.

Reproduction:

Run one Core-routed week after selecting a club.

Observed missing team keys:

- `city`
- `style`
- `sponsor`
- `infrastructureCost`

Severity: CRITICAL

Long-term risk: progressive save degradation after Core weeks.

Replay impact: replay may not include full legacy surface.

Performance impact: none immediate.

Scalability impact: dangerous for modded clubs, world simulation, finances, and career mode.

### HIGH-1: Core replay validation validates latest snapshot with zero actions, not full transition replay

File: `src/FMG.Core/Engine/SimulationEngine.js:241-258`

System: replay validation

Probable cause:

After saving the final weekly snapshot, diagnostics call `validateReplay()`, which loads the latest snapshot and replays an empty action list against the latest checksum. This validates snapshot restoration, not the transition sequence that produced the state.

Reproduction:

Run browser `advanceWeek()` with Core initialized and inspect `coreResult.validation.replay`.

Observed:

- Replay validation returns `ok: true`.
- It does not replay `UPDATE_CLUBS`, `UPDATE_SEASON`, `APPLY_WEEKLY_EFFECTS`, and `ADVANCE_WEEK` from the prior snapshot.

Severity: HIGH

Long-term risk: false confidence in deterministic replay.

Replay impact: high.

Performance impact: low.

Scalability impact: dangerous when replay logs become persistence or debugging authority.

### HIGH-2: GameState checksum is too weak for determinism/corruption validation

File: `src/FMG.Core/Engine/GameState.js:126-135`

System: checksum / snapshot integrity / replay safety

Probable cause:

Checksum only includes version, season week, season number, club count, and manager name. It excludes standings, players, finances, fixtures, match results, tactics, metadata, squad contents, and market state.

Reproduction:

Any two states with same week, season, club count, version, and manager name can share checksum despite different squad/standing/financial data.

Severity: HIGH

Long-term risk: silent corruption can pass replay validation.

Replay impact: high.

Performance impact: low.

Scalability impact: high for large-world debugging.

### HIGH-3: Long-term normal simulation is gated by career dismissal

File: `src/gameEngine.js:794-797`

System: long-term simulation / career loop

Probable cause:

`startNewSeason()` refuses to proceed while career status is `sacked`. In a 50-season normal stress run, the simulation blocked in season 3.

Reproduction:

Run normal season simulation toward 50 seasons without force-resetting career status.

Observed:

`startNewSeason Acepta una oferta antes de iniciar otra temporada.`

Severity: HIGH

Long-term risk: automated long-session simulation cannot run without career-offer handling.

Replay impact: medium.

Performance impact: low.

Scalability impact: high for unattended universe simulation.

### HIGH-4: Save size growth approaches browser localStorage limits

File: `src/saveSystem.js:62-82`

System: persistence

Probable cause:

Full mutable state is serialized to localStorage, including retained retired players and growing subsystem data. Long-term saves grow rapidly.

Observed:

- 25-season save: 4,636,682 bytes.
- 50-season forced save: 7,495,177 bytes.
- Large DB after 10 weeks: 3,950,227 bytes.

Severity: HIGH

Long-term risk: browser save failures, quota errors, partial saves, corrupted player careers.

Replay impact: medium.

Performance impact: high on HDD/low-end systems due serialization cost.

Scalability impact: high.

## 4. High / Medium Issue Report

### MEDIUM-1: FMG.Core utility loading-order dependency can crash scheduler jobs

File: `src/immersionIntegration.js:27-28`

System: simulation scheduler / immersion

Probable cause:

Scheduler job directly calls `FMG.Core.Utils` without checking that Core utilities are loaded. A VM path that loads legacy modules but not Core throws `TypeError: Cannot read properties of undefined (reading 'Utils')`.

Reproduction:

Load legacy runtime including `immersionIntegration.js` but not `src/FMG.Core/Utils/RNG.js`, then advance a week until scheduler runs immersion.

Severity: MEDIUM to HIGH depending on loading path.

Long-term risk: alternate desktop/test bundles can crash.

Replay impact: medium.

Performance impact: low.

Scalability impact: medium.

### MEDIUM-2: Heavy reliance on `Math.random()` outside deterministic Core

Files:

- `src/gameState.js:17`
- `src/transfers.js:64,242,564-565`
- `src/squad.js:407-424,498,592,601`
- `src/matchEngine.js:416`
- `src/finances.js:196,251,255`
- `src/events.js:102`
- phase gameplay/rendering files

System: legacy simulation determinism

Probable cause:

Legacy systems still use `Math.random()` and `Date.now()` for stateful simulation. Some visual-only randomness is acceptable, but many world/gameplay systems rely on nondeterministic global randomness.

Severity: MEDIUM

Long-term risk: replay divergence and hard-to-reproduce save bugs.

Replay impact: high for legacy.

Performance impact: low.

Scalability impact: medium.

### MEDIUM-3: Full-app `innerHTML` rerender can invalidate DOM state and stress low-end devices

File: `src/main.js:199-204`

System: UI rendering

Probable cause:

Every render replaces `#app.innerHTML` for the whole visible shell. Rapid navigation probe passed, but repeated full DOM replacement increases risk of focus loss, detached nodes, expensive layout, and visualizer resync complexity.

Severity: MEDIUM

Long-term risk: UI desync and browser performance degradation as panels grow.

Replay impact: none.

Performance impact: medium.

Scalability impact: medium.

### MEDIUM-4: Global click throttle can drop legitimate rapid UI commands

File: `src/main.js:441-447`

System: browser UI action handling

Probable cause:

All click actions share a 300 ms throttle. This prevented nothing in the scripted route stress because programmatic `.click()` bypassed real time assumptions differently, but human rapid commands may be dropped.

Severity: MEDIUM

Long-term risk: perceived broken UI during fast tactical/live match interaction.

Replay impact: none.

Performance impact: low.

Scalability impact: low.

### MEDIUM-5: Retired players are retained indefinitely

File: `src/squad.js:424-430`, `src/gameEngine.js:823-830`

System: player lifecycle / world simulation

Probable cause:

Retired players remain in `state.players`. Forced 50-season scalability run retained 675 retired players out of 959 total.

Severity: MEDIUM

Long-term risk: save bloat, slower filters, memory growth, larger persistence payloads.

Replay impact: low.

Performance impact: medium to high over many seasons.

Scalability impact: high for player career universe.

### LOW-1: Event bus history is bounded and healthy, but event payloads can still be large

Files:

- `src/architecture.js`
- `src/FMG.Core/Events/EventBus.js`

Observed:

Legacy event history remained capped at 120 in long-run tests. Core event history is capped at 1,000.

Severity: LOW

Risk: large event payloads can still inflate memory temporarily.

## 5. Performance Report

Healthy:

- Existing performance foundation tests passed.
- Phase16 render/listener lifecycle passed 100 dispose cycles.
- Core replay of 1,000 x 50-action sequences took 311 ms.
- Core `advanceWeek()` in browser reported about 7 deterministic ticks / ms-equivalent in its own deterministic timing.

Risky:

- 10 seasons took 31.148 seconds.
- 25 seasons took 94.174 seconds.
- Forced 50 seasons took 273.014 seconds.
- Large database averaged 502.1 ms per week in Node.
- Large database initialization took 6.047 seconds.
- Save serialization reached 7.5 MB in 50 seasons.

Low-end hardware risk:

- AMD FX CPUs may struggle with 500 ms/week large-world simulation.
- HDD systems may experience stutter during multi-megabyte localStorage writes.
- Browser localStorage is synchronous, so large saves can block the main thread.

## 6. Replay Safety Report

Stable:

- Core snapshot restore passed 200 repeated restores.
- Core replay engine produced deterministic checksum for controlled reducer actions.
- 1,000 repeated replay validations passed.

Unsafe:

- Core checksum does not cover enough state.
- Core weekly validation does not replay the transition sequence from the previous snapshot.
- Legacy systems still use nondeterministic `Math.random()`/`Date.now()`.
- Core adapter corruption can still pass replay because checksum is too coarse.

Replay safety rating: 55 / 100

## 7. Memory Stability Report

Stable:

- Event history is capped.
- Browser diagnostic probe did not show listener accumulation.
- Phase16 dispose removed resize listeners.
- Heap after GC stayed reasonable in 10/25/50 forced runs.

Risks:

- Long-run save payload grows faster than browser storage comfort.
- Retired players remain in active save state.
- Full DOM rerender may create temporary detached DOM pressure.
- Match visualizer and playback systems use animation loops; disposal exists but every phase must continue to honor it.

Memory stability rating: 68 / 100

## 8. Browser Stability Report

Stable:

- Real Chrome boot succeeded.
- Onboarding and club selection worked.
- 80 route transitions completed.
- 3 Core week advances completed.
- Save/load completed.
- No uncaught browser runtime exceptions in the successful CDP probe.

Risks:

- Browser save size can exceed localStorage quota in long sessions.
- Main-thread synchronous save writes can freeze low-end browsers.
- Global click throttling can drop rapid interactions.
- Full `innerHTML` rerenders can become expensive as UI complexity grows.

Browser stability rating: 72 / 100

## 9. Long-Term Scalability Report

Ready for scaling:

- Modular scheduler exists.
- Event history is bounded.
- Phase systems have dispose paths.
- Diagnostics/scaling primitives exist.
- Core immutable state and replay primitives exist.

Dangerous for scaling:

- Player population grows and retired players remain.
- Full-state localStorage persistence does not scale.
- Large DB weekly simulation is already ~500 ms/week.
- Career dismissal blocks unattended long-term universe simulation.
- Core adapter is not lossless.
- Legacy random usage prevents reproducible long-run debugging.

Long-term scalability rating: 50 / 100

## 10. System Health Summary

### Stable / Healthy Systems

- Existing automated test coverage across phases.
- Browser boot path under Chrome.
- Onboarding and navigation.
- Legacy 10-season and 25-season simulations when career remains playable.
- Live match minute advancement and finish flow.
- Core snapshot restore.
- Core reducer replay under controlled action sequences.
- Phase16 listener cleanup.
- Event history caps.
- Save backup fallback path in existing tests.

### Systems Ready for Scaling With Caution

- FMG.Core reducers and transition pipeline.
- Replay engine primitives.
- Diagnostics layer.
- Phase16/Phase18 match systems.
- Simulation scheduler.
- Transfer/academy/psychology/media systems at current database sizes.

### Systems Dangerous for Future Expansion

- FMG.Core legacy adapter.
- Core `_autoSelectLineup()` with legacy player field mismatch.
- Save/load full-state localStorage persistence.
- Legacy nondeterministic world systems.
- Retired-player lifecycle.
- Long-term career progression gate.
- Full-app rerender strategy.

### Systems Dangerous for Player Career Mode

- Player data loss through Core bridge.
- Retired players retained without archival strategy.
- Weak checksum/replay validation.
- Save size growth.
- Nondeterministic progression and transfer systems.

### Systems Dangerous for Long-Term Saves

- Core bridge field stripping.
- localStorage quota pressure.
- Full state serialization with growing player records.
- Save metadata/persistence wrappers increasing payload size.

## 11. Final Stability Score

Overall: 62 / 100

Category scores:

- Browser playability: 72
- Core transaction structure: 74
- Replay safety: 55
- Snapshot integrity: 64
- Save/load resilience: 58
- Long-session memory: 68
- Large-world scalability: 50
- Deterministic safety: 46
- Player-career readiness: 42

## 12. Audit Commands Used

Representative commands and probes:

```bash
npm test
```

```bash
node --expose-gc <inline long-season stress probe>
```

```bash
node <inline FMG.Core replay/snapshot probe>
```

```bash
node <inline Chrome DevTools Protocol browser probe>
```

```bash
node <inline large database simulation probe>
```

```bash
node <inline phase16 listener lifecycle probe>
```

## 13. Bottom Line

The game is currently playable and testable in browser, but it is not yet safe to treat FMG.Core as the authoritative simulation path for long-term saves. The highest priority before expansion is to make the Core adapter lossless, fix the legacy/Core player availability contract, strengthen checksums, validate real transition replay, and replace or isolate full-state localStorage persistence for long-running careers.
