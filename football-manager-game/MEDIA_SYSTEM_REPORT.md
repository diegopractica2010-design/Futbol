# MEDIA SYSTEM REPORT
**Fase 5 — Media & Pressure Engine (Advanced)**
**Archivos:** `src/worldMediaPressure.js` + `src/managerEcosystem.js`
**Fecha:** 2026-05-19

## Correcciones Pre-Existentes (Bonus)

| Test | Causa | Fix |
|------|-------|-----|
| phase0 | Assertions hardcodeadas para 13 equipos, datos tienen 16 | Actualizar assertions (16, 30, 288) |
| phase6 | Free agent signing fallaba cuando `budgets.transfers` < signingBonus | Bypass del check de transfers budget para `type === "free"` en transfers.js |
| phase13 | Manager sacked al fin de temporada con 16 equipos → `startNewSeason()` fallaba | Test acepta oferta automáticamente antes de iniciar nueva temporada |

---

## Sistema 1 — Interactive Press Conferences

### Extensión a `eco.media.pressConferences`

Cada conferencia existente recibe `questions[]` automáticamente:
```javascript
conference.questions = [{
  index, question, choices: [{label, tone, text}], answered, selectedChoice
}]
conference.answerable = true
```

### 4 Topics × 3 Preguntas
| Topic | Trigger |
|-------|---------|
| `tactica` | Semana normal |
| `mercado` | Rumor activo |
| `presion` | Racha negativa 3+ |
| `vestuario` | Conflicto interno |

### 3 Tonos con Consecuencias

| Tono | fans | mediaRep | playerTrust | Risk |
|------|------|----------|-------------|------|
| `diplomatic` | +5 | +5 | -3 | — |
| `combative` | -5 | -8 | +6 | Scandal (35%) |
| `honest` | +2 | 0 | +5 | — |

### API Pública
```javascript
FMG.answerPressConference(state, conferenceId, { 0: choiceIdx, 1: choiceIdx, 2: choiceIdx })
// returns { ok, message, record }
```

### Persistencia
`state.career.pressConferenceHistory[]` (max 20) — saved via saveSystem.

---

## Sistema 2 — Scandal System

### `state.scandals[]` (max 8)

**Triggers Automáticos:**
- `conflict > 80` → Faction conflict leak (seed % 8 determinista)
- `player.toxicity > 85` → Toxicity pública (desde Fase 3+4)
- `combative press conference + bad form` → Polémica declaraciones

**Estructura:**
```javascript
{ id, week, seasonNumber, resolved, resolvedWeek, type, severity, title, description, affectedPartyId, mechanicalEffect }
```

**Efectos por Severidad:**
| Severity | Efecto |
|----------|--------|
| 1 | `boardTrust -5` |
| 2 | `boardTrust -12`, `fans.pressure +8`, noticia negativa |
| 3 | Ídem + `morale -15` todo el equipo |

**Auto-Resolución:** 4/6/8 semanas según severidad.

---

## Sistema 3 — Hero/Villain Media Narratives

Conectado automáticamente via wrap de `FMG.generatePostMatchNews`:

**Hero:**
- `mediaReputation +5`
- Titular positivo en noticias (`hero-media-*`)
- Con 3+ créditos en temporada: "Golden boy" narrative + `ego +10`

**Villain:**
- `mediaReputation -8`
- Titular negativo (`villain-media-*`)
- Si es del equipo usuario: `fans.pressure +8`
- Con 3+ créditos: `toxicity +15` + "Problem player" narrative

---

## Sistema 4 — Fan Reactions

### `state.fanReactions[]` (max 10)

**Triggers y Efectos:**

| Trigger | Tipo | Positivo | Efecto Mecánico |
|---------|------|----------|-----------------|
| Racha 4+ victorias | winning-streak | ✅ | +8 home advantage x2 weeks |
| Racha 3+ derrotas | losing-streak | ❌ | morale -5, pressure +10 |
| Victoria en derby | derby-win | ✅ | +8 home advantage x2 weeks |
| Venta de figura (key/OVR≥78) | key-player-sold | ❌ | morale -5, pressure +10 |
| Fichaje importante (OVR≥75) | big-signing | ✅ | +8 home advantage x2 weeks |

### Home Advantage
`world.homeAdvantageBonus` (0-30) + `world.homeAdvantageDuration` (semanas restantes).
Decrece 1 por semana automáticamente.

### UI "Pulso de la hinchada"
Leer `state.fanReactions` para mostrar sección dedicada en el dashboard.
Cada entrada tiene: `icon`, `title`, `body`, `positive`, `mechanical`.

---

## Integración

Todos los sistemas se activan via wrap de `FMG.runManagerEcosystemWeek`:
1. `checkFanReactionTriggers` → analiza streaks y derby
2. `checkScandalTriggers` → conflict leak + toxicidad pública
3. `resolveOldScandals` → auto-resolución por tiempo
4. `checkTransferFanReaction` → reacciones de fichajes de esta semana
5. Decaimiento de home advantage bonus

Post-match: `FMG.generatePostMatchNews` wrapeado para `trackHeroVillainMedia` y detección de derby win.

---

## Sin `Math.random()` — Determinismo Total

| Sistema | RNG Usado |
|---------|-----------|
| Scandal trigger | `hashText("faction-leak-{season}-{week}") % 8` |
| Scandal combativo | `hashText("scandal-pc-{season}-{week}") % 3` |
| Press conference seed | `hashText(conference.id + "-questions")` |
| Fan reaction ID | `deterministicId("fan-rx", [type, season, week])` |
