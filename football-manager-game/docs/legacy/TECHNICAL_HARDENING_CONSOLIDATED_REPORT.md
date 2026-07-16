# Football Manager Game Technical Hardening Consolidated Report

Date: 2026-05-17

## Scope

This document consolidates the repository changes produced by the previous hardening, validation, persistence, stress, UI lifecycle, and long-term simulation phases. It is based on the current repository state and the implemented files, tests, and reports present in `football-manager-game`.

This is a documentation-only report. It does not introduce gameplay changes, refactors, migrations, or new runtime behavior.

## 1. Runtime Authority Hardening

### FMG.Core Authority Model

The project now contains a clearer separation between the legacy global runtime and the newer authoritative runtime surface under `FMG.Core`. The Core layer is initialized through `src/FMG.Core/index.js` and exposes structured systems such as the simulation engine, state snapshots, replay engine, transition pipeline, and legacy state adapter.

The runtime hardening layer in `src/runtimeHardening.js` adds `RuntimeAuthorityManager`, which tracks the intended authority boundary. The current authority is reported as `FMG.Core`, and hardening tests assert that this authority is present. This gives the engine a single named owner for authoritative simulation operations instead of treating all legacy globals as equally authoritative.

### Legacy Compatibility Facade

`LegacyCompatibilityFacade` provides compatibility between the old global `FMG.gameState` model and the newer Core runtime. The compatibility approach is incremental: existing save files, UI flows, and legacy gameplay paths continue to work while Core-facing systems gain structured validation and reporting.

The `LegacyGameStateAdapter` bridges the legacy state shape to and from Core-compatible snapshots. Tests verify that legacy fields and players survive round trips through this adapter.

### Runtime Ownership Validation

`RuntimeOwnershipValidator` and the authority reporting hooks provide visibility into which systems are operating under the intended runtime owner. The hardening report hooks include:

- `FMG.generateRuntimeAuthorityReport()`
- `FMG.generateRemainingLegacyDependencyReport()`
- `FMG.generateUnsafeMutationReport()`
- `FMG.generateRuntimeHardeningReports()`

These reports allow the current runtime boundary to be inspected without requiring a wholesale rewrite of the existing game.

### Mutation Protection

`RuntimeMutationGuard` is present as part of the hardening layer. Its purpose is to detect and report unsafe mutation risks around shared runtime state. The repository also includes immutable-state and hardening tests that exercise state integrity and authority assumptions.

This is not a complete replacement of all mutable legacy systems. Instead, it is a guardrail around the current transition period while the engine still contains both legacy mutable state and Core-managed state.

### Remaining Legacy Risks

The main remaining architectural risk is the continued coexistence of two runtime models:

- Legacy UI and gameplay paths still rely on `FMG.gameState`.
- Some synchronous systems still assume the legacy global state shape.
- Core and legacy state must remain structurally compatible through the adapter.
- Any missing adapter field can cause state loss during migration or replay validation.
- Mutation protection is advisory and diagnostic unless every write path is routed through guarded APIs.

### Migration Strategy

The current migration strategy is conservative and compatible. Core authority is introduced alongside the legacy runtime instead of replacing it all at once. This preserves existing saves and UI behavior while giving the project diagnostics, adapters, deterministic validation, and report hooks.

The next safe migration step is to move specific domains one at a time into Core-owned transitions, then validate each domain through replay, save/load, and browser runtime tests before removing the corresponding legacy write path.

## 2. Deterministic Runtime Hardening

### Deterministic RNG Systems

The deterministic runtime phase introduced `DeterministicRNGEngine` and RNG state serialization. Tests verify that RNG state can be snapshotted, restored, and replayed. The deterministic test suite also scans runtime source usage to prevent direct `Math.random()` and `Date.now()` calls in hardened runtime paths.

This gives simulation and replay systems a controlled source of randomness instead of allowing ambient browser or JavaScript runtime nondeterminism to enter simulation logic.

### SimulationClock

`SimulationClock` provides a controlled clock abstraction for simulation progression. It supports deterministic time handling by replacing direct wall-clock reads in hardened systems with an explicit simulation-time source.

The clock is part of the same runtime hardening layer as deterministic RNG, replay hashing, and validation.

### Replay Consistency Systems

The Core runtime includes replay infrastructure through `ReplayEngine`, transition logging, and replay validation helpers. The deterministic hardening layer adds `DeterministicReplayValidator`, which can validate repeated replay loops against stable snapshots and hashes.

Tests cover deterministic replay loops and rollback behavior. The replay stress harness also performs repeated replay validation, with synthetic fallback behavior when a full replay engine is not available.

### Replay Validation Systems

Replay validation is implemented through several layers:

- Core replay and transition systems.
- `DeterministicReplayValidator` for repeated deterministic checks.
- `TickReplayInspector` for detecting the tick where divergence appears.
- Stress harness replay loops for repeated runtime validation.
- Replay persistence integrity checks through `ReplayDeltaStorage`.

Together, these systems detect unstable replay output, corrupted replay persistence, and hash divergence.

### Replay Divergence Protection

`ReplayHashEngine` creates deterministic hashes from canonicalized runtime state. Tests verify stable key ordering and support for sorted entity arrays. `TickReplayInspector` can identify divergence during a replay sequence instead of only reporting that final state differs.

The current divergence protection is strongest around Core-compatible snapshots and deterministic test scenarios. Full legacy UI and live match flows still require broader replay coverage before they can be considered fully replay-authoritative.

### Deterministic Hashing

`ReplayHashEngine` performs stable serialization and hashing. It is used by replay validation, save/load determinism checks, and rollback verification.

Tests confirm that:

- Object key order is canonicalized.
- Entity arrays can be sorted for stable hashing.
- Save/load cycles can preserve deterministic hashes.
- Snapshot rollback can return to a previous deterministic hash.

### Remaining Determinism Risks

Remaining risks include:

- Legacy systems that still use ambient browser state or mutable globals.
- UI events and asynchronous persistence ordering outside the deterministic simulation core.
- Replay stress fallbacks that validate infrastructure behavior but are not equivalent to full real-game replay coverage.
- Live match and browser interaction flows requiring more end-to-end deterministic capture.

## 3. Persistence Hardening

### IndexedDB Architecture

The persistence phase introduced `WorldPersistenceEngine`, which supports IndexedDB-backed persistence with an in-memory fallback. It stores committed manifests, chunks, replay records, archive records, and related persistence metadata.

The architecture is additive. Existing localStorage saves remain compatible, while new saves can also be written through the IndexedDB-oriented incremental pipeline.

### Dual-Write Compatibility Strategy

`src/saveSystem.js` continues to write a localStorage-compatible payload for existing synchronous load paths. When the incremental save pipeline is available, saves are also enqueued into the new persistence path. The save status reports this as a dual-write mode.

This strategy preserves existing saves and existing UI behavior while allowing the engine to build toward IndexedDB-first loading through `FMG.loadFromSlotAsync()`.

### Chunked Saves

`IncrementalSavePipeline` converts large save payloads into chunked manifests. The pipeline writes chunks through `WorldPersistenceEngine` and marks a manifest as committed only after the chunk set is complete.

Validation checks cover:

- Manifest status.
- Chunk count and order.
- Chunk checksums.
- Full manifest checksum.
- Incomplete or pending manifest rejection.

This reduces the risk of treating partially written saves as valid.

### Delta Serialization

`DeltaSerializer` records changed top-level keys per save slot and can apply deltas back onto base state. This provides the base mechanism for delta-based saves and incremental serialization.

The current implementation focuses on safe incremental adoption. It does not remove the compatibility full snapshot path yet.

### Replay Persistence

`ReplayDeltaStorage` persists replay delta payloads with checksums. Tests verify that valid replay deltas load correctly and corrupted replay persistence is rejected.

Replay persistence is now covered by integrity checks rather than being treated as opaque data.

### Entity Persistence States

Entity persistence states were added:

- `active`
- `visible`
- `background`
- `archived`

The layered world and persistence systems use these states to reduce active save pressure. Archived retired players can be removed from the active checkpoint and persisted as archive records.

### Corruption Recovery

The save system now includes backup-aware load behavior. If a primary localStorage payload is corrupted, `loadFromSlot` can recover from the `.bak` slot. `SaveIntegrityValidator` validates save shape, and `loadFromSlotAsync()` can reject incomplete IndexedDB manifests before falling back to compatibility loading.

Tests cover corrupted primary slot recovery and corrupted replay checksum rejection.

### Migration Compatibility

Migration compatibility remains a core constraint. Existing legacy saves are still readable through the localStorage path, and tests verify compatibility with legacy v4 save payloads.

The persistence reports include:

- `FMG.generatePersistenceIntegrityReport()`
- `FMG.generateScalabilityReport()`
- `FMG.generateMigrationRiskReport()`

### Scalability Improvements

The persistence architecture improves scalability by:

- Avoiding dependence on one monolithic full snapshot as the only future save format.
- Introducing chunked manifests for large saves.
- Supporting delta records.
- Supporting archived entity storage.
- Preserving compatibility during migration.

### Remaining Persistence Risks

The most important remaining persistence risks are:

- The synchronous UI load path still depends on localStorage full payloads.
- IndexedDB-first loading exists through `loadFromSlotAsync()` but is not yet the only path.
- Browser private mode, quota pressure, and IndexedDB failures require more real-browser coverage.
- Archive retention and compaction policies need future hardening.
- Broader world subsystem archival is not yet proven across every entity type.

## 4. UI Lifecycle & Leak Hardening

### Listener Tracking

`ListenerRegistry` tracks event listener registration and cleanup. Tests verify that listeners can be added and removed through the registry.

This provides a central mechanism to detect listener accumulation and stale listener references when UI flows are repeatedly mounted, updated, or destroyed.

### Render Scheduling

`RenderScheduler` centralizes render scheduling. Its role is to prevent uncontrolled rerender storms and to give UI rendering a single scheduling path instead of allowing duplicate render loops to accumulate.

### Detached DOM Detection

`DetachedDOMDetector` detects detached DOM node risks. This supports leak detection for UI elements that have been removed from the document but are still referenced by runtime systems.

### RAF Loop Protection

`RenderLoopAnalyzer` detects duplicate `requestAnimationFrame` loop risks and render loop instability. This is part of the UI lifecycle hardening layer and feeds render stability reporting.

### Persistent UI Shell

`PersistentUIShell` provides a retained UI shell model. Tests verify that it can update a retained route panel instead of repeatedly rebuilding disconnected UI roots.

This reduces overlay leaks, stale route containers, and unnecessary DOM churn during navigation.

### UI Stress Infrastructure

`UINavStressHarness` performs repeated navigation and render spam against either `FMG.render()` or the persistent UI shell. The broader `RuntimeStressHarness` can include UI spam alongside save, replay, memory, and world simulation stress.

### Memory Diagnostics

`RuntimeMemoryDiagnostics` samples runtime memory indicators and leak-related counts. `MemoryStressHarness` repeatedly samples memory and can allocate transient objects to exercise cleanup behavior.

UI lifecycle report hooks include:

- `FMG.generateUILifecycleReport()`
- `FMG.generateRenderStabilityReport()`
- `FMG.generateMemoryLeakReport()`

### Remaining UI Risks

Remaining UI risks include:

- Browser heap metrics vary by browser and are strongest in Chromium-based diagnostic paths.
- Listener tracking is strongest for listeners registered through the registry or hooked APIs.
- Real browser overlay stress and fullscreen stress need expanded browser automation coverage.
- Canvas, animation, and screen-specific render loops still need ownership audits as the UI grows.

## 5. Runtime Stress Infrastructure

### RuntimeStressHarness

`RuntimeStressHarness` orchestrates the major stress systems. It can run browser probes, replay loops, save/load loops, UI navigation spam, memory sampling, world simulation loops, and match spam.

The main entry point is:

- `FMG.runRuntimeStress(options)`

Report hooks include:

- `FMG.generateRuntimeStressReport()`
- `FMG.generateReplayStabilityReport()`
- `FMG.generateSaveStabilityReport()`
- `FMG.generateUIStabilityReport()`
- `FMG.generateStressMemoryReport()`

### ReplayStressHarness

`ReplayStressHarness` runs repeated replay loops and validates deterministic stability. It can use the real replay validator or a synthetic fallback when a full replay engine is unavailable.

The fallback is useful for infrastructure validation but should not be treated as proof of full-game replay determinism.

### SaveStressHarness

`SaveStressHarness` repeatedly saves and loads game state. It also exercises corruption injection and recovery paths. Tests cover repeated save/load loops and corrupted save recovery.

### UINavStressHarness

`UINavStressHarness` performs repeated UI route and render operations. It targets navigation spam and rerender stability.

### MemoryStressHarness

`MemoryStressHarness` samples runtime memory over repeated loops. It supports transient allocation pressure and feeds memory reporting.

### WorldSimulationHarness

`WorldSimulationHarness` advances world simulation loops and can perform match spam. It tolerates blocked legacy/Core paths unless configured to fail on blocked week advancement.

### Automated Validation Systems

The stress infrastructure validates:

- Replay loop stability.
- Save/load loop stability.
- UI navigation spam behavior.
- Memory sampling stability.
- World week advancement.
- Match spam execution.
- Browser probe availability.

### Corruption Injection Systems

Corruption injection is present in save stress and persistence tests. The current coverage includes corrupted localStorage primary payload recovery and corrupted replay checksum rejection.

### Browser Stress Systems

The current repository contains browser-oriented probes and UI stress harnesses. These provide a foundation for browser stress automation, but the next level of proof should include longer Playwright or Chrome DevTools Protocol runs that collect real console, heap, RAF, overlay, and fullscreen behavior over time.

## 6. Long-Term World Simulation

### LongTermSimulationRunner

`LongTermSimulationRunner` performs accelerated decade-scale world simulation validation. It supports 10-year, 25-year, and 50-year simulation runs without requiring a slow full fixture simulation for every validation pass.

The public hooks include:

- `FMG.runLongTermSimulation()`
- `FMG.runLongTermSimulationSet()`

### WorldEntropyAnalyzer

`WorldEntropyAnalyzer` measures long-term world shape and scalability indicators:

- Entity counts.
- Active and retired player split.
- Free agent counts.
- Squad distribution entropy.
- Average age.
- Average overall.
- Rating variance.
- Entity explosion.
- Squad imbalance.
- World homogenization.

The report hook is:

- `FMG.generateWorldScalingReport()`

### FootballEvolutionAnalyzer

`FootballEvolutionAnalyzer` evaluates football-specific evolution indicators:

- Average overall.
- Elite, youth, and veteran populations.
- Transfer volume.
- Formation diversity.
- Club style diversity.
- Economic spread.
- Tactical stagnation.
- Football realism decay.
- Economic instability.
- Homogenization.

The report hook is:

- `FMG.generateFootballEvolutionReport()`

### Accelerated Decade Simulations

Automated tests run accelerated 10-year, 25-year, and 50-year simulations. These tests verify that the accelerated world does not immediately collapse through entity explosion, memory collapse, homogenization, or severe realism decay.

### Transfer Simulation

Massive transfer simulation writes real market history entries and moves players between real teams. The 50-year validation checks that transfer history exists after the long-term run.

### Retirement and Regeneration Systems

Massive retirement cycles retire aging players and create lineage-linked regens. Long-term tests verify that retired players exist and that regenerated players include lineage references.

### World Homogenization Detection

World homogenization is detected through entropy, rating variance, squad distribution, formation diversity, and club style diversity. This gives the engine early warning when long simulations collapse into sameness.

### Football Realism Preservation

Football realism preservation is evaluated through age, quality, elite/youth/veteran distribution, transfers, economics, formations, and club style diversity.

### Tactical Stagnation Detection

Tactical stagnation detection is handled by `FootballEvolutionAnalyzer`, which tracks formation and style diversity over long simulations.

### Scalability Validation

The long-term simulation tests validate that entity counts and world complexity remain within expected bounds during accelerated 10-year, 25-year, and 50-year runs.

### Remaining Long-Term Simulation Risks

Accelerated decade simulations are not the same as full fixture-by-fixture simulation. They are appropriate for scale and stability validation, but they do not fully prove football realism under every match, transfer, injury, development, and economic path.

Future validation should include slower full-season and full-career simulations with richer telemetry.

## 7. Validation & Testing Coverage

### Replay Tests

Replay and deterministic validation are covered by `tests/deterministicRuntime.test.js` and `tests/hardening.test.js`. Coverage includes deterministic RNG restoration, replay hash stability, repeated replay loops, replay divergence detection, deterministic save/load hashing, and rollback hashing.

### Save and Load Loops

`tests/persistenceArchitecture.test.js` covers rapid save/load loops, IndexedDB mock persistence, incremental pipeline drain behavior, async slot loading, corrupted localStorage recovery, incomplete manifest rejection, replay delta integrity, and legacy migration compatibility.

`tests/runtimeStressHarness.test.js` also covers save stress loops and corruption recovery through `SaveStressHarness`.

### Corruption Tests

Corruption coverage includes:

- Corrupted primary localStorage save recovery from `.bak`.
- Incomplete pending manifest rejection.
- Corrupted replay delta checksum rejection.
- Save stress corruption injection.

### UI Spam Tests

UI spam is covered by `UINavStressHarness` in `tests/runtimeStressHarness.test.js`. Hardening tests also validate `ListenerRegistry` and `PersistentUIShell` behavior.

### Memory Sampling

`MemoryStressHarness` is tested with repeated memory sampling and transient allocation pressure. `RuntimeMemoryDiagnostics` supports memory-related reporting.

### Long-Term Simulations

`tests/longTermWorldSimulation.test.js` covers:

- 10-year accelerated simulation.
- 25-year accelerated simulation.
- 50-year accelerated simulation.
- Accelerated timeline checks.
- Massive transfer simulation effects.
- Retirement and regeneration cycles.
- World scaling report generation.
- Football evolution report generation.
- Long-term stability report generation.

### Runtime Validation

Runtime validation is covered by:

- `tests/hardening.test.js`
- `tests/deterministicRuntime.test.js`
- `tests/persistenceArchitecture.test.js`
- `tests/runtimeStressHarness.test.js`
- `tests/longTermWorldSimulation.test.js`

The `npm test` script includes these hardening and validation tests as part of the broader suite.

### Browser Validation

The stress infrastructure includes browser probe support and UI navigation stress. Previous validation also verified that the application runtime could still start through the development server. The current automated browser stress layer is foundational; extended real-browser console, heap, fullscreen, resize, and overlay soak tests remain recommended.

## 8. Remaining Risks

### Unresolved Architectural Risks

The engine is still in a transitional architecture where Core authority and legacy globals coexist. This is safer than a forced rewrite, but it means authority violations remain possible until more write paths are moved behind Core-owned transitions.

### Replay Risks

Replay systems are substantially stronger, but full-game replay maturity still depends on capturing every authoritative input and all nondeterministic sources. Legacy live match, UI-driven workflows, and asynchronous side effects need broader replay capture before replay can be considered complete.

### Async Persistence Risks

IndexedDB persistence and async loading exist, but localStorage compatibility remains central to synchronous UI flows. Until the UI is fully migrated to async slot loading, large localStorage payloads can still create quota and main-thread pressure.

### Memory Risks

UI lifecycle diagnostics now exist, but long-running real-browser memory behavior still needs deeper soak tests. Detached DOM detection, RAF loop analysis, and listener tracking are most valuable when paired with browser automation that repeatedly opens overlays, changes routes, resizes, enters fullscreen, and idles.

### Scalability Risks

Chunking, archival, and accelerated world validation reduce scalability risk, but they do not eliminate it. Risks remain around archive growth, IndexedDB quota, retained history size, economic model drift, and full fixture simulation costs.

### Future Migration Risks

Migration risk is concentrated around compatibility boundaries:

- Legacy save payloads must remain readable.
- Core snapshots must preserve all required legacy fields.
- IndexedDB manifests must not become the only readable format until compatibility is proven.
- Archive policies must avoid deleting data that older systems still expect.

### Long-Term World Simulation Risks

Accelerated validation can miss issues that only appear in full match-by-match simulation. Tactical diversity, economic balance, player development, injuries, and transfer market behavior all require future validation against slower and more realistic simulation paths.

## 9. Current Engine Maturity

### Architecture Maturity

Architecture maturity is transitional but meaningfully improved. The project now has an explicit Core authority model, compatibility facade, mutation diagnostics, and ownership reports. It is not yet a fully Core-owned engine.

### Replay Maturity

Replay maturity is solid at the deterministic infrastructure level and improving at the runtime level. Hashing, replay loops, divergence detection, and replay persistence integrity are implemented. Full end-to-end gameplay replay remains a future hardening target.

### Persistence Maturity

Persistence maturity has advanced from localStorage-only snapshots toward a scalable dual-write architecture with IndexedDB, chunked manifests, deltas, replay persistence, archive records, and corruption recovery. The remaining maturity gap is making async IndexedDB-first loading the primary UI path.

### Testing Maturity

Testing maturity is strong for Node and VM-based automated validation. The suite now covers determinism, hardening, persistence, stress infrastructure, and long-term simulation. Browser stress maturity is still developing and should move toward longer real-browser automation.

### Scalability Maturity

Scalability maturity is improved. The engine now has chunked saves, archived entity handling, stress harnesses, memory sampling, and accelerated 10/25/50-year simulation validation. Full real-time decade simulation remains more expensive and less automated.

### Browser Stability Maturity

Browser stability has foundational protections: render scheduling, persistent shell behavior, listener tracking, detached DOM diagnostics, RAF loop analysis, and UI stress harnesses. More proof is needed through extended browser soak testing with console and heap capture.

### Future Readiness

The engine is better prepared for future growth. The hardening work created measurable boundaries, report hooks, and validation tools. The next phase should focus on proving these systems under longer, more realistic, browser-backed workloads rather than adding broad new architecture.

## 10. Next Recommended Technical Priorities

### What Should Happen Next

1. Move the main UI load path toward `FMG.loadFromSlotAsync()` while preserving localStorage fallback.
2. Promote IndexedDB manifests into a first-class save slot index with visible validation status.
3. Expand replay capture to live match and UI-driven gameplay flows.
4. Add real-browser stress automation for navigation, overlays, fullscreen, resize, idle, console errors, heap growth, detached DOM, and RAF loops.
5. Calibrate long-term simulation thresholds against slower full-season runs.
6. Extend entity archival policies beyond retired players where safe.
7. Continue moving one gameplay domain at a time behind Core-owned transitions.

### What Should Not Happen Yet

1. Do not remove localStorage compatibility until IndexedDB-first loading is proven across browsers and older saves.
2. Do not rewrite the save system in one step.
3. Do not make gameplay balance changes based only on accelerated long-term simulation.
4. Do not force every legacy system behind Core authority until adapter coverage is complete.
5. Do not delete archive or history data without a retention policy and migration test coverage.

### Systems That Still Require Proof

- Full browser memory stability over long sessions.
- Full replay determinism for live match workflows.
- IndexedDB quota behavior with very large worlds.
- Cross-browser persistence behavior, including private browsing modes.
- Full fixture-by-fixture 25-year and 50-year simulation stability.
- Overlay and fullscreen lifecycle cleanup under repeated user interaction.

### Systems That Require Future Hardening

- Core ownership of remaining legacy mutation paths.
- Async persistence adoption in UI workflows.
- Replay persistence flushing and recovery for live sessions.
- Archive compaction and retention.
- Browser-based detached DOM and listener leak telemetry.
- Economic, tactical, and player development validation over realistic long simulations.

## Conclusion

The previous hardening phases moved the engine from mostly legacy global runtime behavior toward a measured, validated, and incrementally scalable architecture. The most important achievement is not a single system, but the creation of enforceable boundaries and repeatable validation: Core authority reports, deterministic hashing, replay validation, IndexedDB chunking, corruption recovery, UI lifecycle diagnostics, stress harnesses, and long-term world analyzers.

The engine is not finished, and the repository still carries transitional risk. However, the current foundation is much safer for future work because the next migrations can be proven with targeted tests and reports instead of relying on manual confidence.
