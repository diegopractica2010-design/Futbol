# MATCH NARRATIVE REPORT
**Fase 2 — Match Narrative Engine**
**Archivo:** `src/matchNarrative.js`
**Fecha:** 2026-05-19

## Resumen

`matchNarrative.js` extiende `news.js` sin reemplazarlo mediante wrapping de `FMG.generatePostMatchNews` y `FMG.advanceLiveMatch`.

## Sistema 1 — Story Arcs

Clasificación post-partido almacenada en `result.narrativeArc`:

| Arc | Condición |
|-----|-----------|
| `comeback` | Equipo abajo 2+ goles remonta o empata |
| `collapse` | Equipo arriba 2+ goles pierde |
| `thriller` | 3+ goles en últimos 15 minutos |
| `shutout_drama` | Portería a cero con 8+ remates rival |
| `giant_killing` | Equipo 4+ posiciones más bajo gana |
| `boring_point` | 0-0 con menos de 4 remates totales |
| `derby_classic` | Partido de rivalidad con 2+ goles cada equipo |
| `standard` | Partido normal |

## Sistema 2 — Hero/Villain

**Hero:** Hat-trick > Portero en 0-0 con 3+ paradas > Goleador decisivo
**Villain:** Tarjeta roja en derrota > Gol en propia (proxy xg < 0.05)

Efectos mecánicos:
- Hero: `confidence +12`, `mediaReputation +8`
- Villain: `confidence -15`, `mediaReputation -10`

Almacenado en `result.matchHero` y `result.matchVillain`.

## Sistema 3 — Legendary Moments

`state.legendaryMoments[]` (máx 50, persistido en save).

Tipos detectados automáticamente:
- `last_minute_winner`: gol en minuto ≥ 88
- `hat_trick`: jugador marca 3+ goles
- `massive_comeback`: remontada desde 3+ goles abajo
- `derby_decider`: gol decisivo en minuto ≥ 85 en derbi

## Sistema 4 — Dramatic Commentary

6+ plantillas por arc, selección determinista via `hashText`. Anti-repetición mediante dedupeKey único por partido/temporada.

## Sistema 5 — Final Minute Pressure

Narrativas inyectadas en `liveMatch.result.timeline` como eventos de tipo `"narrative"` en minuto ≥ 85:
- Empate: "El empate no le sirve a ninguno..."
- 1 gol diferencia: "El marcador tiembla..."
- Equipo usuario perdiendo: "Todo o nada para [club]..."

## Integración

```javascript
// Wrapping limpio sin modificar news.js
const _origPostMatchNews = FMG.generatePostMatchNews;
FMG.generatePostMatchNews = function(state, result) { ... };

const _origAdvanceLiveMatch = FMG.advanceLiveMatch;
FMG.advanceLiveMatch = function(state, minutes) { ... };
```

## API Pública

```javascript
FMG.matchNarrative.classifyArc(state, result)
FMG.matchNarrative.findHero(state, result)
FMG.matchNarrative.findVillain(state, result)
FMG.matchNarrative.detectLegendaryMoments(state, result)
FMG.matchNarrative.enrichResult(state, result)
FMG.matchNarrative.ensureLegendaryMoments(state)
FMG.matchNarrative.getPressureNarrative(state, liveMatch, minute)
```
