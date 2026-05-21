# EMOTIONAL MOMENTUM REPORT
**Pre-Phase-10 | src/humanFootballAI.js + src/matchNarrative.js**

## Systems Active

### In-Match Emotional Momentum (humanFootballAI.js)
- `EMOTIONAL_GOAL_SURGE = 20` (6 min duration) on goal scored
- `EMOTIONAL_SAVE_SURGE = 12` (4 min) on great save
- `EMOTIONAL_MISS_DROP = 15` (4 min) on high-xg miss
- `rivalryMultiplier = 1.3` on derby matches (all surges 30% larger)
- Affects: `pressureBonus`, `liveMatch.momentum` (±3% per emotional point)
- `momentumGap > 40` → losing side gets desperation boost
- `momentumGap > 60` → winning side `pressingIntensity × 0.95` (complacency)

### Momentum Gap Effects
```
gap < 40: standard play
gap 40-60: losing team adds desperation +0.35, pressureBonus +0.05
gap > 60: winning team pressingIntensity × 0.95 → pressureBonus reduced
```

### Final Minute Tension (matchNarrative.js)
8 TIED_LINES + 8 ONE_GOAL_LINES (doubled from 4 each)
- Minute ≥ 85: injected into `timeline` as `type: "narrative"` events
- Also fires at minute 90 (removed `liveMatch.completed` guard)

## Validation
- Derby test: `rivalryMultiplier = 1.3` ✓
- Pressure narratives fire at tense moments ✓
- Deterministic (no Math.random) ✓
