# LEGACY ENGINE REPORT
**Fase 9 — Legacy & History Engine**
**Archivo:** `src/legacyEngine.js` (nuevo)
**Fecha:** 2026-05-19

## Estado Persistido: `state.legacy`

```javascript
state.legacy = {
  version: 1,
  hallOfFame: [],               // max 100
  allTimeRecords: {
    topScorer:       { playerId, name, goals, seasonNumber },
    mostAppearances: { playerId, name, appearances, seasonNumber },
    highestOverall:  { playerId, name, overall, season },
    mostTitles:      { playerId, name, titles }
  },
  playerCareerStats: {          // acumulado por temporada, sin reset
    [playerId]: {
      goals, appearances, seasonsAbove80,
      peakOverall, titles, titlesByClub, teamIds
    }
  },
  clubTimelines: { [clubId]: [] }, // max 30 por club
  managerLegacy: {
    totalTitles, seasonsManaged, clubsManaged,
    legendaryMomentsInvolved, hallOfFamePlayersNurtured,
    legacyScore, legacyLabel
  },
  seasonDocumentaries: []        // max 10
}
```

---

## Sistema 1 — Hall of Fame

### Condiciones (cualquiera es suficiente)
| Condición | Umbral |
|-----------|--------|
| Títulos con el mismo club | ≥ 3 |
| Goles en carrera | ≥ 50 |
| Apariciones en carrera | ≥ 150 |
| Temporadas con overall > 80 | ≥ 5 |

### Estructura de entrada
```javascript
{
  id, playerId, name, clubId, clubName,
  inductedSeason, reason, reasonText,
  stats: { goals, appearances, titles, seasonsAbove80, peakOverall },
  portraitColor  // vía FMG.getClubIdentity
}
```

### Integración
- Agrega evento al club timeline del jugador inducido
- Genera noticia automática si el club es el del usuario

---

## Sistema 2 — Career Records

Tracking de 4 récords históricos, actualizados en cada fin de temporada:

| Récord | Campo comparado | Noticia si se rompe |
|--------|----------------|---------------------|
| Máximo goleador | `careerStats.goals` | Sí |
| Más apariciones | `careerStats.appearances` | No (silencioso) |
| Mayor overall histórico | `careerStats.peakOverall` | No |
| Más títulos | `careerStats.titles` | No |

### Acumulación de Stats
El hook `accumulateCareerStats` se ejecuta al inicio de `evaluateCareerSeasonEnd`, **antes** de que `preparePlayersForSeason` resetee `seasonStats`. Garantiza que todos los goles y apariciones se contabilizan correctamente.

---

## Sistema 3 — Club Timelines

Evento añadido a `state.legacy.clubTimelines[clubId][]` (max 30/club) automáticamente desde:

| Fuente | Tipo de evento |
|--------|----------------|
| `worldHistory.dynasties` | `"dynasty"` — consecutive titles milestone |
| `worldHistory.fallenGiants` | `"fallen-giant"` / `"recovery"` |
| `state.legendaryMoments` | `"legendary-moment"` |
| Campeón de temporada | `"title"` |
| Hall of Fame induction | `"hof-induction"` |

### API
```javascript
FMG.LegacyEngine.getClubTimeline(state, "colo-colo")
// → [{ id, season, type, description }]
```

---

## Sistema 4 — Manager Legacy Score

### Fórmula
```javascript
legacyScore = (titles × 12) + (seasonsManaged × 3) + (clubsManaged × 2)
            + (legendaryMoments × 8) + (hofPlayers × 15)
```

### Labels por Puntaje

| Rango | Label |
|-------|-------|
| 81-100 | Monumento vivo |
| 61-80 | Idolo eterno |
| 41-60 | Leyenda local |
| 21-40 | Recordado |
| 0-20 | Pasajero |

### Acceso
```javascript
FMG.LegacyEngine.getManagerLegacy(state)
// → { totalTitles, seasonsManaged, clubsManaged, legacyScore, legacyLabel, ... }
```

---

## Sistema 5 — Documentaries

Texto narrativo de 3 párrafos por temporada, generado automáticamente:

**Párrafo 1 — Resultado deportivo:**
Posición final, puntos, campeón de la temporada. Si hay contexto de dinastía, lo menciona.

**Párrafo 2 — Momentos épicos:**
Hat-tricks, remontadas, derbis decisivos desde `state.legendaryMoments`. Si no hay momentos, texto reflexivo genérico.

**Párrafo 3 — Vestuario y legado:**
Escándalos, eventos de ego-clash, clasificación de legado actual del técnico.

**Persistencia:** `state.legacy.seasonDocumentaries[]` (max 10), deduplicado por `deterministicId("doc", [season, teamId])`.

### Acceso
```javascript
FMG.LegacyEngine.getDocumentaries(state)
// → [{ id, season, teamId, clubName, paragraphs: [p1, p2, p3] }]
```

---

## Hook de Integración

Envuelve `FMG.evaluateCareerSeasonEnd` (ya envuelto por worldEvolution.js):

```
career.js evaluateCareerSeasonEnd
  → worldEvolution.js runWorldEvolutionSeasonEnd
    → legacyEngine.js runLegacySeasonEnd
      1. accumulateCareerStats  (antes del reset de seasonStats)
      2. updateCareerRecords
      3. checkHallOfFame
      4. syncClubTimelines
      5. computeManagerLegacy
      6. generateSeasonDocumentary
```

---

## API Pública Completa

```javascript
FMG.LegacyEngine.ensure(state)
FMG.LegacyEngine.runSeasonEnd(state, seasonRecord)
FMG.LegacyEngine.getHallOfFame(state)
FMG.LegacyEngine.getClubTimeline(state, clubId)
FMG.LegacyEngine.getDocumentaries(state)
FMG.LegacyEngine.getManagerLegacy(state)
FMG.LegacyEngine.getAllTimeRecords(state)
FMG.LegacyEngine.addToClubTimeline(state, clubId, type, description, season)
FMG.ensureLegacy(state)
```

## Tests: 31/31 ✓
