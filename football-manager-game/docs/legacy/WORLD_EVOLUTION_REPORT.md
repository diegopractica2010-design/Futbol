# WORLD EVOLUTION REPORT
**Fase 8 — Dynamic Football World Evolution**
**Archivo:** `src/worldEvolution.js` (nuevo)
**Fecha:** 2026-05-19

## Estado Persistido: `state.worldHistory`

```javascript
state.worldHistory = {
  version: 1,
  dynasties:       { [clubId]: { titles, consecutiveTitles, lastTitleSeason, isDynasty } },
  fallenGiants:    { [clubId]: { badSeasons, status, fallenSeason, budgetPenalty } },
  goldenGenerations: { [clubId]: { active, season, playerIds } },
  tacticalEras:    { history[], currentEra, eraStartSeason, consecutiveSeasons },
  economicCycle:   { phase, phaseSince, inflationMultiplier },
  worldEvents:     [] // max 40
}
```

Serializable automáticamente por `saveSystem.js`.

---

## Sistema 1 — Dynasties

### Tracking
Actualizado en cada `FMG.evaluateCareerSeasonEnd`:
- El campeón acumula `consecutiveTitles +1`
- Todos los demás clubs resetean `consecutiveTitles = 0`
- `isDynasty = true` cuando `consecutiveTitles >= 3`

### Efectos de Dinastía

| Efecto | Valor |
|--------|-------|
| Prestige bonus | +8 |
| Budget multiplier | ×1.12 para rivalAI |
| Rival motivation | Rivales del usuario ganan `morale +5` semana del partido |

### Narrativas
- Inicio de dinastía: noticia "Nace una dinastia"
- Fin de dinastía: noticia "El fin de una era"

### API
```javascript
FMG.WorldEvolution.getDynastyBonus(state, teamId)
// → { prestige: 8, budgetMultiplier: 1.12 } | { prestige: 0, budgetMultiplier: 1 }
```

---

## Sistema 2 — Fallen Giants

### Trigger
Club con `prestige > 80` (vía `FMG.ClubCulture.DNA`) que termina en la mitad baja de la tabla por 3+ temporadas consecutivas.

### Efectos al "caer"
- Noticia narrativa "La caída de [club]"
- Si es el equipo del usuario: `finances.balance -30%`, `budgets.transfers -15%`
- Top 2 jugadores clave reciben `transferRequest = true`, `happiness -12`
- Almacenado en `worldHistory.fallenGiants[id].status = "fallen"`

### Recuperación
Al volver al top-4 después de "fallen": genera "El renacimiento" con noticia automática.

---

## Sistema 3 — Golden Generations

### Detección
Al final de cada temporada: jugadores en top-10 por `overall` con `age < 26`.
Si 3+ jugadores del mismo club → "golden_generation" para ese club.

### Efectos
- Noticia "Generacion dorada"
- Si es el equipo del usuario: `fans.pressure -10` (hinchada optimista)
- Registro en `worldHistory.goldenGenerations[clubId]`
- Si el club gana el título: candidato a momento legendario (visible en legacyEngine)

### API
```javascript
FMG.WorldEvolution.getGoldenGeneration(state, teamId)
// → { active, season, playerIds } | null
```

---

## Sistema 4 — Tactical Eras

### Detección del Estilo Dominante
Se examina el top-6 de la tabla al final de la temporada.
El estilo táctico de cada club proviene de `FMG.ClubCulture.DNA[clubId].tacticalDNA`.
El estilo más frecuente entre los líderes = estilo dominante de la temporada.

### Activación de Era
Tras **2 temporadas consecutivas** con el mismo estilo dominante → `currentEra` se activa.

### Efectos en Partidos
Envuelve `FMG.computeTeamStrength` con flag `_evolutionWrapped`:

| Club vs Era | Bonus |
|-------------|-------|
| Mismo estilo que la era | -2 strength (predictibilidad) |
| Estilo diferente a la era | +3 strength (sorpresa táctica) |

### API
```javascript
FMG.WorldEvolution.getCurrentEra(state)             // "pressing" | "attacking" | null
FMG.WorldEvolution.getTacticalEraSurpriseBonus(state, teamId)  // -2 | 0 | 3
```

---

## Sistema 5 — Economic Cycles

### Determinismo
```javascript
cycleIndex = Math.floor((seasonNumber - 1) / 4)
phase = PHASES[hashText("econ-cycle-" + seed + "-" + cycleIndex) % 3]
```
Completamente reproducible dado el mismo `state.seed`.

### Fases cada 4 Temporadas

| Fase | Market Inflation | AI Budget | User Budget |
|------|-----------------|-----------|-------------|
| boom | ×1.15 | +15% | +7.5% balance |
| neutral | ×1.0 | 0% | 0% |
| crisis | ×0.88 | -12% | -6% balance |

### Integración con Transfer Market
Modifica `advanced.economy.inflation` y `advanced.economy.inflationMultiplier` directamente.
`FootballEconomyController.marketAdjustedValue` lee `economy.inflation` → precios de jugadores ajustados automáticamente.

---

## Hooks Implementados

| Hook | Cuando | Qué hace |
|------|--------|----------|
| `FMG.evaluateCareerSeasonEnd` | Fin de temporada | Corre los 5 sistemas |
| `FMG.startNewSeason` | Inicio de nueva temporada | Aplica efectos de ciclo económico a presupuestos |
| `FMG.computeTeamStrength` | Cada cálculo de fuerza | Añade bonus/malus de era táctica |
| `FMG.runManagerEcosystemWeek` | Semanal | Aplica motivación rival vs. club dinasta |

---

## API Pública Completa

```javascript
FMG.WorldEvolution.ensure(state)
FMG.WorldEvolution.runSeasonEnd(state, seasonRecord)
FMG.WorldEvolution.getDynastyBonus(state, teamId)
FMG.WorldEvolution.getCurrentEra(state)
FMG.WorldEvolution.getTacticalEraSurpriseBonus(state, teamId)
FMG.WorldEvolution.computeEconomicPhase(state)
FMG.WorldEvolution.getGoldenGeneration(state, teamId)
FMG.WorldEvolution.isFallenGiant(state, teamId)
FMG.ensureWorldHistory(state)
```

## Tests: 31/31 ✓
