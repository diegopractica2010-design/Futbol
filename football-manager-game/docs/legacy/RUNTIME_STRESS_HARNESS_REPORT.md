# Runtime Stress Harness Report


Date: 2026-05-17

## Runtime Stress Report

- Added `RuntimeStressHarness` as the orchestrator for browser probing, replay loops, save/load loops, UI navigation spam, memory sampling, world simulation, and match spam.
- Added `FMG.runRuntimeStress(options)` for executing the combined harness from tests or browser console.
- Added `FMG.generateRuntimeStressReport()` for the latest aggregate result.

## Replay Stability Report

- Added `ReplayStressHarness`.
- Supports deterministic replay engines with snapshot/action loops.
- Falls back to synthetic replay loop checks when no replay engine is attached.
- Exposed through `FMG.generateReplayStabilityReport()`.

## Save Stability Report

- Added `SaveStressHarness`.
- Runs repeated `saveToSlot` and `loadFromSlot` loops.
- Injects corrupted localStorage payloads and verifies backup/fallback recovery.
- Includes incremental pipeline state when available.
- Exposed through `FMG.generateSaveStabilityReport()`.

## UI Stability Report

- Added `UINavStressHarness`.
- Spams route changes and render calls through either `FMG.render()` or `PersistentUIShell`.
- Flushes `RenderScheduler` where available to catch queued render buildup.
- Exposed through `FMG.generateUIStabilityReport()`.

## Memory Report

- Added `MemoryStressHarness`.
- Samples `RuntimeMemoryDiagnostics`, optional transient allocations, listener trends, and detached DOM trends.
- Exposed through `FMG.generateStressMemoryReport()`.

## World Simulation Report

- Added `WorldSimulationHarness`.
- Runs long-session week advancement attempts and match spam attempts.
- Tolerates intentionally blocked legacy/Core paths unless configured with `failOnBlockedWeek`.
- Captures layered world simulation plan when available.

## Automated Coverage

- `tests/runtimeStressHarness.test.js` executes:
  - automated browser execution probe
  - replay loops
  - save/load loops
  - corruption injection
  - UI spam
  - memory profiling samples
  - long-session world simulation attempts
  - match spam attempts

## Validation

- `node tests/runtimeStressHarness.test.js`
- `npm test`
- Dev server entrypoint check returned HTTP 200 for `http://localhost:8080/`.
