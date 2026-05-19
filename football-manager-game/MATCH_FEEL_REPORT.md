# Match Feel Report

## Applied

- Added inertia and velocity carry to tactical marker animation.
- Added deterministic lane and stride variance per player.
- Ball motion keeps quicker blending than players so passes and shots retain urgency.
- No gameplay result, match event, save, replay, or persistence code was changed.

## Expected Feel

- Less abrupt direction snapping.
- Slightly more organic off-ball drift.
- Less repeated trajectory overlap between players with similar tactical targets.

## Remaining Repetition

- Repeated match engine events can still produce similar attacking waves.
- Formation shape repetition remains possible when tactical state is stable for many ticks.
