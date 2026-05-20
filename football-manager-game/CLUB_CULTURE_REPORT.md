# CLUB CULTURE REPORT
**Fase 7 — Club Culture & Fanbase Engine**
**Archivo:** `src/clubCulture.js` (nuevo)
**Fecha:** 2026-05-19

## Sistema 1 — Club DNA (`FMG_CLUB_DNA`)

DNA fijo para los 16 clubes de la liga. Nunca cambia entre temporadas.

| Club | tacticalDNA | fanExpectation | prestige |
|------|------------|----------------|---------|
| Colo-Colo | pressing | champion | 95 |
| U. de Chile | attacking | champion | 90 |
| U. Católica | structured | contender | 85 |
| Cobreloa | pressing | contender | 68 |
| Wanderers | attacking | consistent | 62 |
| U. Española | attacking | consistent | 62 |
| Cobreloa | pressing | contender | 68 |
| Everton | balanced | consistent | 60 |
| Huachipato | defensive | consistent | 60 |
| Palestino | balanced | consistent | 58 |
| O'Higgins | structured | consistent | 58 |
| Cobresal | defensive | survival | 55 |
| Audax Italiano | structured | consistent | 55 |
| Nublense | defensive | survival | 52 |
| Coquimbo Unido | balanced | survival | 52 |
| La Serena | balanced | survival | 48 |
| Dep. Antofagasta | balanced | survival | 50 |

### Acceso vía API
```javascript
FMG.ClubCulture.getDNA("colo-colo")
// → { identity, tacticalDNA, fanExpectation, prestige, traditionsKey }
```

---

## Sistema 2 — Fan Expectation Pressure

Comparación semanal entre `fanExpectation` del DNA y posición actual:

| fanExpectation | Posición que activa | Nivel de presión |
|----------------|---------------------|-----------------|
| champion | ≥ 4 | crisis |
| contender | > mitad de tabla | concern |
| consistent | > mitad+2 | concern |
| survival | zona de descenso (últ. 2) | fear |

### Efectos Mecánicos

| Nivel | boardTrust | morale equipo |
|-------|-----------|---------------|
| crisis | -8/semana | -3/semana |
| concern | -4/semana | -2/semana |
| fear | -6/semana | -4/semana |
| ok | 0 | 0 |

Con nivel `crisis` o `fear`, genera noticia automática en `state.worldNews`.

Estado persistido en `state.clubCulture.pressureByTeam[teamId]`.

---

## Sistema 3 — Stadium Atmosphere

Datos de estadio para los 16 clubes en `FMG_STADIUM`:

| Club | Estadio | Capacidad | passionRating | intimidationFactor |
|------|---------|-----------|---------------|-------------------|
| Colo-Colo | Monumental | 47,000 | 95 | 14 |
| U. de Chile | Nacional | 48,000 | 92 | 13 |
| U. Católica | San Carlos | 20,000 | 82 | 9 |
| Wanderers | Elias Figueroa | 18,000 | 70 | 8 |
| Cobresal | El Cobre (El Salvador) | 4,000 | 62 | 8 |
| ... | ... | ... | ... | ... |

### Extensión de Home Advantage

`FMG.computeTeamStrength` wrapeado con flag `_cultureWrapped`:
```javascript
bonus = intimidationFactor * 0.1
// Monumental: 14 * 0.1 = +1.4 strength
// Nacional: 13 * 0.1 = +1.3 strength
```
Se suma al `+4` existente de home advantage en `matchEngine.js`.

Bonus post-victoria de derby: +3 adicionales por 3 semanas.

---

## Sistema 4 — Derby Culture

### Pre-Derby (1 semana antes)
Detecta si el próximo fixture del usuario es un derby via `FMG.getRivalry`.

Efectos:
- `eco.manager.pressure +12`
- `world.media.pressure +15`
- `player.morale +3` (todo el equipo)
- Genera noticia "La semana del clásico"

### Post-Derby (3 semanas)
Efectos de victoria:
- `finances.boardTrust +8`
- `homeAdvantageModifiers[uid] +3` (3 semanas)
- `player.morale +10`
- `eco.manager.pressure -15`

Efectos de derrota:
- `finances.boardTrust -12`
- `player.morale -8`
- `eco.manager.pressure +15`

Estado en `state.clubCulture.postDerby[teamId]` con campo `expiresWeek`.

---

## Sistema 5 — Traditions

Disparadores por `traditionsKey` del DNA:

| Tradition | Trigger | Efecto |
|-----------|---------|--------|
| superclasico | Semana 1 | Media boost +10 |
| copa-libertadores-historia | Top 3 + mitad de temporada | Morale +5 |
| hinchada-caliente / hinchada-pueblo | Semana 2 | Home bonus +2 |
| academia / cantera | 3+ jugadores sub-22 en plantel | Fan approval +5 |
| proceso / filosofia-italiana | Semana 3 | Tactical recognition |
| clasico-universitario | Semana 1 | Media boost +8 |

Cada tradición se dispara 1 vez por temporada (deduplication via `deterministicId`).
Estado en `state.clubCulture.activeTraditions[]` (max 20).

---

## Persistencia

```javascript
state.clubCulture = {
  version: 1,
  pressureByTeam: { [teamId]: { level, position, dna } },
  derbyWeek: { [teamId]: { week, opponent, name } },
  postDerby: { [teamId]: { week, won, expiresWeek, score } | null },
  activeTraditions: [ { id, tradition, seasonNumber, week, teamId, title, body, effect } ],
  homeAdvantageModifiers: { [teamId]: Number }
}
```

Serializable por `saveSystem.js` (JSON plain objects).

---

## API Pública

```javascript
FMG.ClubCulture.getDNA(teamId)        // DNA del club
FMG.ClubCulture.getStadium(teamId)    // datos del estadio
FMG.ClubCulture.getPressureLevel(dna, pos, total)  // nivel de presión
FMG.ClubCulture.runWeek(state)        // ejecutar ciclo semanal
FMG.ClubCulture.DNA                   // objeto completo con los 16 clubs
FMG.ClubCulture.STADIUM               // objeto completo estadios
FMG.ensureClubCultureState(state)     // inicializar estado
```

## Tests: 31/31 ✓
