# CAREER PSYCHOLOGY REPORT
**Fase 10 — Player Career Mode | Tests: 34/34 ✓**

## Implementation: src/playerCareer.js

### State: state.playerCareer
- reputation: local/league/world/fanPop/mediaImage (0-100 each)
- psychology: confidence/pressure/ambition/morale/burnout/discipline
- lifestyle: professionalism/trainingFocus/nightlifeRisk/recoveryQuality
- career: goals/assists/matches/trophies/clubs/loyalty
- decisions: bounded 10, interactive choices with mechanical effects
- events: bounded 20, auto-generated career events
- legacy: legendScore/hallOfFame/legendaryMoments(15)/retirementSummary

### Systems active
1. Reputation engine (local→league→world cascade)
2. Psychology engine (burnout, pressure, ambition lifecycle)
3. Career decisions (5 templates, resolvePlayerCareerDecision API)
4. Engagement hook reactions (focus/rest/press/ignore)
5. Social relationships (mentor bonds → teammate chemistry)
6. Lifestyle (nightlife risk → scandals, training focus → star boost)
7. Match experience (derby/legendary moment hooks)
8. Media integration (conference tone → mediaImage)
9. Automatic career events (burnout-crisis, fan-love, transfer-rumor)
10. Legacy & retirement summary with hallOfFame criteria

### Weakness Fixes (Part A)
- A-4 Jealousy: accumulator 2-4 semanas (orgánico, no seed%4)
- A-5 Factions: MIN_FACTION = max(2, floor(squadSize/7))
- A-6 Mentor bond: overall +1 cuando bond>=60 (máx +3 carrera)
- A-7 pressingIntensity: ahora escala pressureBonus Y shotQualityMultiplier
- A-8 Dressing choices: FMG.resolveDressingRoomEvent() implementado

### Packaging
- PWA: sw.js offline, manifest.json actualizado, landscape orientation
- Desktop: electron/main.js + npm run desktop:install/desktop/desktop:dist
- Android APK: capacitor.config.json + npm run android:init/sync/open
- Touch CSS: targets 48px mín, scroll táctil, safe-area
- Tablet CSS: Lenovo M11 landscape (1200x800) + portrait (800x1200)

All 34/34 tests pass | 0 lint errors | Save compatible ✓
