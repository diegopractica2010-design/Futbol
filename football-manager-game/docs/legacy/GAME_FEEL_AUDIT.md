# Game Feel Audit

## Match Motion

Before this pass, player motion relied on direct eased interpolation to each new tactical point. It was deterministic and stable, but could look like repeated snapping between lanes.

Applied:

- Added velocity carry and interpolation blending in `src/matchVisualizer.js`.
- Added tiny deterministic player-specific lane/stride variance based on player id, minute bucket, and position.
- Kept all changes visual-only; no match result, event timeline, save, or replay architecture was modified.
- Avoided `Math.random`; all entropy is derived from existing deterministic identifiers.

## Pacing

Findings:

- Screens often delivered every system at the same weight, reducing emotional pacing.
- Important football beats were diluted by archival/systemic information.
- Dashboard and match views needed stronger “what matters now” presentation.

Applied:

- Primary panels now carry the visible first read.
- Deeper logs and secondary systems are accessible but no longer compete with current-week decisions.
- Dashboard copy now speaks to the week, the dressing room, and match preparation.

## Remaining Match Feel Risks

- Tactical event variety still depends on the underlying match engine.
- Canvas rendering is improved visually, but animation remains a lightweight 2D tactical board rather than a full physics simulation.
- Repeated tactical shapes can still appear when the same possession/momentum state repeats for several ticks.
