# MATCH FEEL 2.0 REPORT
**Pre-Phase-10 Consolidation | src/tacticalIntelligence.js**

## Mejoras implementadas

### Inertia / Movement Arcs
Added `inertiaX`/`inertiaZ` using a second phase wave (`phaseWave2` at 0.19×tempo).
Players now exhibit a drift/overshoot effect when repositioning — the classic
broadcast "player running past and adjusting" illusion.

### Diagonal Support Runs
New `diagRun` component using `cos(diagPhase)` × `role.diag` (new role property).
Previously all off-ball runs were pure vertical (Z-axis). Now EXT and MED players
move along diagonal trajectories — creating genuine overlap and underlap geometry.
`diag` values: POR=0, DEF=0.18, MED=0.62, EXT=0.88, DEL=0.72.

### Ball Weight Illusion
Ball position now has a 1-frame anticipation offset (actor `velX/velZ`) simulating
the ball slightly leading the carrier's direction — creates sense of weight/momentum.
Ball arc `arcY = 0.22 + |sin(minute×0.44)|×0.12` adds subtle bounce/height variation.
Ball path uses compound sine `sin(0.31) + cos(0.17)` for naturalistic non-repetitive trajectory.

### Overlap Runs
`overlapBoost`: wingers/fullbacks surge forward during attacking transitions
(`phase.intensity × 3.5 × sideSign`). Creates visible overlap geometry in high-press attacks.

### Defensive Shape
`cbSpread`: centre-backs spread wider (`base.x × 0.18`) when NOT in possession to
cover channels — creates compact vs open shape variation between attack/defense phases.

### Ball Pull Differentiation
`ballWeightX/Z` now varies by role (attack=0.22, wing=0.18, others=0.14) instead
of flat value. Strikers chase the ball more aggressively; defensive players hold shape.

## Before vs After
| Factor | Before | After |
|--------|--------|-------|
| Support runs | Linear vertical only | Diagonal + vertical compound |
| Off-ball movement | sin(phaseWave×0.7) | sin + cos(diagPhase) combined |
| Ball position | Straight-line estimates | Compound sine + arc height |
| Defensive shape | Symmetric | CBs spread wider in defense |
| Overlap runs | None | Winger surge on transitions |
| Inertia | Instant position snapping | Dual-wave drift/overshoot |

## No Breaking Changes
- All existing `match?.humanAI` reads preserved
- All existing `desperation`/`panic`/`positionError` reads preserved
- `_estimateBall` signature unchanged
- Zero new state objects
