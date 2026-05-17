# Persistence Architecture Report

Date: 2026-05-17

## Persistence Integrity Report

- Legacy slot saves remain readable through the existing `localStorage` keys.
- New saves are dual-written: compatibility payload in `localStorage`, chunked committed manifests in IndexedDB through `WorldPersistenceEngine`.
- Chunked saves validate manifest status, chunk count, chunk order, chunk checksum, and full manifest checksum before load.
- Corrupted primary slot payloads recover through the existing `.bak` key.
- Replay deltas are stored with checksums and rejected when the persisted replay payload is tampered with.

## Scalability Report

- `IncrementalSavePipeline` splits serialized checkpoint payloads into chunks before writing to IndexedDB.
- `DeltaSerializer` records changed top-level state keys per slot and can reapply delta records to a base state.
- Entity persistence states are classified as `active`, `visible`, `background`, and `archived`.
- Archived players are removed from the active checkpoint payload and persisted separately as archive records.
- Runtime report hooks expose chunk count, byte length, entity state counts, world layer plan, and localStorage size risk.

## Migration Risk Report

- Strategy: dual-write migration with existing `localStorage` compatibility retained.
- Backward compatibility is preserved for legacy slots, exported saves, imported saves, and old-version migration through `FMG.migrateSaveState`.
- Main residual migration risk: the current settings UI calls the synchronous `loadFromSlot`; IndexedDB-first loading is available as `loadFromSlotAsync` and needs UI adoption in a later step.
- IndexedDB unavailable/private-mode browsers fall back to the existing compatibility payload.

## Remaining Persistence Risks

- The synchronous UI load path still depends on the full compatibility payload.
- Replay frame buffers can now be persisted through `ReplayDeltaStorage`, but live match replay buffers do not yet auto-flush every capture window.
- Archive retention and compaction policy are not yet configurable for very long careers.
- Large save compaction should eventually be promoted from player archival to broader world subsystem archival.

## Verification

- `node tests/persistenceArchitecture.test.js`
- `npm test`
- Dev server entrypoint returned HTTP 200 from `http://localhost:8080/`.
