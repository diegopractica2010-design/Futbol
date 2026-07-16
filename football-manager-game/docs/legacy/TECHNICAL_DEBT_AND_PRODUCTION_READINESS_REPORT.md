# TECHNICAL DEBT & PRODUCTION READINESS REPORT
**Football Manager Chile — Análisis Técnico Profundo Fases 1-9**
**Fecha:** 2026-05-20 | **Tests:** 31/31 ✓

---

## RESUMEN EJECUTIVO

El proyecto tiene una arquitectura determinista sólida y 31/31 tests pasando. Los sistemas de backend generan estado correctamente y los hooks están encadenados sin ciclos. Sin embargo, existen **4 bugs de estado** donde datos calculados nunca llegan a tener efecto, **18 sistemas con UI ausente**, **6 sistemas de estado muerto** y **3 áreas de deuda técnica con overlap conceptual**. El juego es completamente jugable en su flujo principal; los problemas afectan principalmente features nuevas de las Fases 3-9.

---

# PRIORIDAD P0 — BUGS CRÍTICOS DE PRODUCCIÓN

## BUG-01: boardTrust Split State (Confirmado en Runtime)

**Archivos:** `src/worldMediaPressure.js:617-620` ← escribe | `src/career.js:297` ← lee | `src/finances.js:102-108` ← autoridad

**Flujo Real (verificado):**
```
eco.manager (init): { personality, pressure, burnout, mediaReputation, legacy }
                     ← NO tiene campo "boardTrust"

applyScandal() → eco.manager.boardTrust = (eco.manager.boardTrust || eco.manager.trust || 50) - 5
                 → Crea campo huérfano en eco.manager

career.js línea 297:
  state.finances.boardTrust  ← Sistema de despido lee AQUÍ (finanzas)
  eco.manager.boardTrust     ← Nadie lee AQUÍ (ecosistema manager)
```

**Verificación runtime:** `eco.manager` no tiene campo `boardTrust` por defecto. Cuando los escándalos lo crean, es un campo nuevo que existe solo en el objeto del ecosistema. La directiva que decide despidos lee exclusivamente `state.finances.boardTrust`, que nunca es afectado por escándalos.

**Impacto gameplay:** Escándalos de severidad 1, 2 y 3 no afectan la posibilidad de despido. El mecanismo de presión de escándalos → despido está completamente roto. Un jugador puede acumular 8 escándalos sin consecuencia en su estabilidad laboral.

**Consumidores de `state.finances.boardTrust`:**
- `career.js:297` — condición de despido
- `career.js:279` — evaluación de objetivos de temporada
- `career.js:335` — historial de carrera
- `managerEcosystem.js:140,265` — lee boardTrust de finances para actualizar board politics y manager.pressure

**Consumidores de `eco.manager.boardTrust`:** Ninguno.

**Estado canónico:** `state.finances.boardTrust` (único locus de verdad para el sistema de despido y evaluación).

**Fix mínimo:** En `applyScandal()`, reemplazar escritura a `eco.manager.boardTrust` con `FMG.updateBoardTrust(state, "Escandalo", -delta)` que escribe en `state.finances.boardTrust`.

**Complejidad:** Baja (cambio de 2 líneas). **Riesgo regresión:** Muy bajo.

---

## BUG-02: homeAdvantageBonus Sin Consumidor (Confirmado)

**Archivos:** `src/worldMediaPressure.js:558` ← escribe | ningún archivo ← lee

**Flujo Real:**
```
Fan Reaction positiva:
  world.homeAdvantageBonus = clamp(bonus + 8, 0, 30)
  world.homeAdvantageDuration += 2
  ↓
  [FIN — nadie lee world.homeAdvantageBonus]

Match calculation:
  homeStrength = FMG.computeTeamStrength(homeTeam, ...) + 4 + ...
                 ↑
  computeTeamStrength está wrapeado por clubCulture.js:
    stadiumStrengthBonus(state, team) → cc.homeAdvantageModifiers[team.id]
                                        ↑
                                        Este es el OTRO sistema (derby/traditions)
                                        NO lee world.homeAdvantageBonus
```

**Dos sistemas paralelos de home advantage:**
| Sistema | Estado | Consumidor |
|---------|--------|-----------|
| Fan Reactions (Fase 5) | `world.homeAdvantageBonus` | ❌ Ninguno |
| Derby/Traditions (Fase 7) | `cc.homeAdvantageModifiers[teamId]` | ✓ `stadiumStrengthBonus()` → `computeTeamStrength` |

**Impacto gameplay:** Las victorias en derbis, rachas ganadoras y fichajes que deberían dar ventaja local para las próximas 2 fechas no tienen ningún efecto mecánico en partidos. `homeAdvantageDuration` decrece correctamente cada semana pero el bonus nunca se aplica.

**Diagnóstico:** Los dos sistemas nacieron en paralelo. Fase 7 implementó el home advantage via `computeTeamStrength` (correcto). Fase 5 lo implementó via un campo en `worldMedia` sin crear el consumidor.

**Sistema correcto:** El de Fase 7 (`cc.homeAdvantageModifiers`) que llega al motor de partidos.
**Sistema redundante:** `world.homeAdvantageBonus` que es dead state.

**Fix mínimo:** En `applyFanReactionEffect()`, escribir en `state.clubCulture.homeAdvantageModifiers[state.userTeamId]` en lugar de `world.homeAdvantageBonus`. O leer `world.homeAdvantageBonus` en `stadiumStrengthBonus()`.

**Complejidad:** Baja. **Riesgo regresión:** Muy bajo.

---

## BUG-03: Economic Inflation Overwrite Semanal (Confirmado)

**Archivos:** `src/worldEvolution.js:404-407` ← escribe 1 vez | `src/advancedTransferMarket.js:178` ← sobreescribe cada semana

**Flujo Real:**
```
SEASON END (1 vez):
  updateEconomicCycle() → adv.economy.inflation *= inflationMultiplier
  (Ej: boom → inflation 1.0 × 1.15 = 1.15)

WEEKLY (cada semana, incluyendo la semana 1 de nueva temporada):
  FootballEconomyController.update() →
    inflation = clamp(1 + momentum/180 + fees/900M, 0.86, 1.42)
    ← Recálculo desde cero, ignora inflationMultiplier
```

**Verificación runtime (Temporada 1 neutral):**
```
inflation BEFORE evaluateCareerSeasonEnd: 1.32
inflation AFTER evaluateCareerSeasonEnd: 1.32
economicCycle.phase: "neutral"
economicCycle.inflationMultiplier: 1.0
```
El multiplicador neutro (1.0) no cambia nada. El primer ciclo no-neutro ocurre en temporada 5 (si seed % 3 ≠ "neutral"). Cuando ocurra, el efecto durará hasta que `FootballEconomyController.update()` se llame por primera vez en la nueva temporada (primera semana).

**Único efecto real que persiste:** `applyBudgetCycleEffects()` modifica `state.rivalAI.budgets[teamId]` y `state.finances.balance` en `startNewSeason()`. Esto sí es permanente porque `rivalAI.budgets` no se recalcula automáticamente cada semana.

**Impacto gameplay:** El ciclo económico afecta presupuestos de IA y balance del usuario (correcto y funcional). El precio de mercado de jugadores (via `inflation`) no refleja el ciclo económico de forma sostenida.

**Causa raíz:** `FootballEconomyController.update()` tiene su propia fórmula que ignora el ciclo. El `inflationMultiplier` se almacena en `adv.economy.inflationMultiplier` pero ese campo tampoco es leído por `FootballEconomyController.update()`.

**Fix mínimo:** En `FootballEconomyController.update()`, multiplicar el resultado por `advanced.economy.inflationMultiplier || 1`.

**Complejidad:** Muy baja (1 línea). **Riesgo regresión:** Bajo (solo afecta rango de precios).

---

## BUG-04: pressingIntensity Sin Consumidor

**Archivos:** `src/humanFootballAI.js:135,301` ← escribe | ningún archivo ← lee

**Flujo Real:**
```
humanFootballAI.js:
  emptySideModifiers() → { pressingIntensity: 1 }
  
  // Cuando momentum gap > 60:
  modifiers[winningSide].pressingIntensity *= 0.95

  liveMatch.humanAI.modifiers = modifiers  ← almacenado

matchEngine.js addLiveMinuteEvent():
  const homeHuman = humanModifiers.home || {};
  
  // Lee: pressureBonus, shotQualityMultiplier, onTargetMultiplier,
  //       foulMultiplier, cornerBonus, savePenalty, strengthBonus,
  //       possessionShift, desperation
  
  // NO lee: pressingIntensity
```

**Impacto gameplay:** La mecánica de "complacency" — equipo ganando con mucha ventaja presiona menos — está declarada pero no implementada. El equipo dominante no pierde intensidad de pressing cuando el momentum gap supera 60.

**Relación con tactical profile:** `getTacticalMatchProfile()` genera `profile.chance`, `profile.attack`, etc. El `pressingIntensity` debería modificar algo de ese perfil o la fórmula de presión. No hay conexión.

**Fix mínimo:** En `addLiveMinuteEvent()`, multiplicar la fórmula de `pressure` por `attackHuman.pressingIntensity || 1`. Alternativa: multiplicar `attackProfile.chance` antes del cálculo.

**Complejidad:** Baja. **Riesgo regresión:** Bajo (ajuste de balance de mecánica existente).

---

# PRIORIDAD P1 — SISTEMAS INCOMPLETOS CON IMPACTO GAMEPLAY

## INC-01: `getDynastyBonus().budgetMultiplier` Sin Consumidor

**Declarado:** `worldEvolution.js:144` → `{ prestige: 8, budgetMultiplier: 1.12 }`
**Leído por:** Nadie. `FMG.WorldEvolution.getDynastyBonus` existe en la API pública pero ningún sistema interno lo invoca.

**Impacto:** Los clubes con dinastía (3+ títulos consecutivos) deberían atraer mejores agentes libres y tener mayor presupuesto de fichajes. Este efecto está calculado pero nunca aplicado.

**Qué sí funciona:** La motivación rival (+5 morale) y las noticias narrativas de inicio/fin de dinastía sí son activas.

**Fix mínimo:** En `runWorldEvolutionSeasonEnd()` o en `applyBudgetCycleEffects()`, leer el bonus para clubs con dynasty y aplicar multiplicador a `rivalAI.budgets`. Complejidad baja.

---

## INC-02: `player.mediaReputation` Sin Consumidor

**Escrito por:**
- `matchNarrative.js`: hero +8, villain -10
- `worldMediaPressure.js`: hero +5, villain -8

**Leído por:** Ningún sistema de gameplay. `worldMediaPressure.js:395` lee `state.managerEcosystem?.manager?.mediaReputation` (del manager, no del jugador).

**Estado:** `player.mediaReputation` existe en objetos de jugadores pero ninguna mecánica lo usa para:
- Valor de mercado (no leído en `calculatePlayerValue`)
- Demanda salarial (no leído en `estimatePlayerWageDemand`)
- Interés de fichajes (no leído en `generateIncomingOffers`)
- Noticias adicionales (no leído en ningún templatede noticias)

**Impacto gameplay leve:** Los jugadores acumulan reputación mediática sin que esta afecte su valor de mercado ni la frecuencia de ofertas externas. La mecánica de "jugador famoso = más ofertas" no existe.

---

## INC-03: `pressCombative → boardTrust` Sin Puente

**Declarado:** Press conference combativa + mal momento → `FMG.MediaExtended.addScandal()` → `applyScandal()` → `eco.manager.boardTrust -= 5`

**Problema:** Ver BUG-01. El escándalo generado por una respuesta combativa escribe en `eco.manager.boardTrust`, no en `state.finances.boardTrust`. La conexión press conference → despido está rota.

---

## INC-04: `mentor.mentorBondStrength` Sin Payoff

**Estado:** Incrementa +1/semana (0→100). La única consecuencia mecánica de la relación mentor-protegido que debería variar según `bondStrength` es la penalización cuando el mentor se va (`youngster.confidence -= 8`). Esta penalización es fija (-8) independientemente de `bondStrength`.

**Impacto:** Mentores que llevan 60 semanas con su protegido tienen el mismo impacto de salida que los de 1 semana.

---

## INC-05: Protector Agent Sin Comportamiento Semanal

**Estado:** La personalidad "protector" es asignada a ~20% de agentes (1 en 5 en el `pickByHash`). En `runAgentWeeklyBehavior()`, solo hay casos para: mediatico, duro, relacional, pragmatico. El protector no tiene comportamiento activo.

**Spec requería:** "Protector agents block transfers below loyalty threshold."

**Impacto gameplay:** 20% de los agentes en el juego no tienen comportamiento semanal diferenciado. Los jugadores con agentes protectores deberían ser más difíciles de vender cuando su lealtad es alta, pero esto no está implementado.

---

# PRIORIDAD P2 — UI FALTANTE

## CLASIFICACIÓN POR COMPLEJIDAD

### EASY (datos listos, solo render)

**UI-01: Fan Pulse / "Pulso de la hinchada" en Dashboard**
- Backend: ✅ Completo. `state.fanReactions[]` con `{ title, body, icon, positive, mechanical }`.
- Ubicación natural: `ui/dashboard.js` — sección ya existente de noticias/hinchas.
- Pattern: Leer `state.fanReactions`, filtrar últimas 3, renderizar con ícono y descripción.
- Riesgo integración: Nulo.

**UI-02: Dressing Room Events en Weekly Summary**
- Backend: ✅ Completo. `state.dressingRoomEvents[]` con `{ type, title, description, icon, choices }`.
- Ubicación natural: `ui/careerView.js` — sección "Vestuario y staff" ya existente (línea 88).
- Pattern: Añadir lista de eventos recientes. Los `choices` son datos descriptivos (sin efecto si no hay resolución).
- Riesgo integración: Bajo.

**UI-03: Club Traditions en Dashboard**
- Backend: ✅ Completo. `state.clubCulture.activeTraditions[]`.
- Ubicación natural: `ui/dashboard.js` o sección de club en `ui/careerView.js`.
- Pattern: Badge o sección pequeña con tradiciones activas de la temporada.
- Riesgo integración: Nulo.

**UI-04: Scanner de Escándalos Activos**
- Backend: ✅ Completo. `state.scandals[]` con severity, description, resolved.
- Ubicación natural: `ui/careerView.js` sección de presión mediática.
- Pattern: Lista de escándalos activos con countdown de resolución.
- Riesgo integración: Nulo.

**UI-05: Promesas Activas en Player Detail**
- Backend: ✅ `FMG.getActivePromises(state)` implementado en transfers.js extensión.
- Ubicación: `ui/playerView.js` o modal de jugador.
- Pattern: Lista de promesas con semanas activas.
- Riesgo integración: Nulo.

---

### MEDIUM (backend completo, lógica UI moderada)

**UI-06: Press Conference Interactiva**
- Backend: ✅ Completo. `FMG.answerPressConference(state, conferenceId, answers)`. Conferencias con `answerable: true` y `questions[]`.
- Actual: `ui/careerView.js:114-118` muestra solo el tema y periodista (lectura pasiva).
- Faltante: Renderizar `questions[]` con radio buttons para cada choice. Botón que llame `FMG.answerPressConference`. Refrescar vista.
- Riesgo integración: Medio (requiere formulario interactivo y manejo de estado).

**UI-07: Loyalty Conflict Resolution**
- Backend: ✅ `FMG.getLoyaltyConflicts(state)` + `FMG.resolveLoyaltyConflict(state, id, decision)`.
- Ubicación natural: Market view o notificación urgente en dashboard.
- Faltante: Modal con opciones match/release/block. Countdown de 2 semanas visible.
- Riesgo integración: Medio.

**UI-08: Club Timeline (Club View)**
- Backend: ✅ `FMG.LegacyEngine.getClubTimeline(state, clubId)`.
- Ubicación: Nueva sección en `ui/rivalView.js` (vista de rivals ya existe) o nuevo tab en career.
- Pattern: Timeline scrollable con iconos por tipo de evento.
- Riesgo integración: Bajo-Medio.

**UI-09: Season Documentaries**
- Backend: ✅ `FMG.LegacyEngine.getDocumentaries(state)` con 3 párrafos por temporada.
- Ubicación: Nueva subsección en career view o en el resumen de fin de temporada.
- Riesgo integración: Bajo.

---

### HARD (requieren nuevas rutas en FMG.ROUTES + vistas completas)

**UI-10: Hall of Fame View (`/hall-of-fame`)**
- Backend: ✅ `FMG.LegacyEngine.getHallOfFame(state)`. Entradas con portada de color (club), stats, razón.
- Faltante: Nueva ruta en `gameState.js`, nueva entrada en nav, nuevo archivo `ui/hallOfFameView.js`.
- Riesgo integración: Medio-Alto (toca gameState.js, main.js, requiere nuevo archivo).

**UI-11: Historia View (`/history`)**
- Backend: ✅ `state.worldHistory.dynasties`, `state.legacy.seasonDocumentaries`, `state.legendaryMoments`.
- Faltante: Nueva ruta + vista + renderizado de timelines históricos.
- Riesgo integración: Alto.

**UI-12: Legacy View (`/legacy`)**
- Backend: ✅ `state.legacy.managerLegacy` con legacyScore y legacyLabel.
- Faltante: Nueva ruta + vista de manager legacy con score visual.
- Riesgo integración: Alto.

---

# PRIORIDAD P3 — DEUDA TÉCNICA

## DT-01: Duplicación Estado `confidence`

**Tres sistemas paralelos trackean "confianza" del jugador:**

| Campo | Sistema | Actor | Efecto mecánico |
|-------|---------|-------|-----------------|
| `player.confidence` | humanFootballAI (Fase 1) | Partidos | ✅ Shot quality, pressing |
| `psych.players[id].emotions.confidence` | squadPsychology (Fase 3) | Semanal | ✅ Afecta `player.morale` |
| `player.ego` | squadPsychology ext (Fase 3) | Semanal | ✅ Eventos vestuario |

**Problema:** Los tres evolucionan de forma independiente. Un jugador puede tener:
- `player.confidence = 85` (humanAI, partido fue bien)
- `emotions.confidence = 30` (psych, mal momento prolongado)
- `player.ego = 90` (alto desde inicio)

No hay feedback entre `player.confidence` (Fase 1) y `emotions.confidence` (Fase 3). El `emotions.confidence` afecta `player.morale` que luego afecta `player.confidence` en humanAI via `applyPostMatchModifiers`, pero el ciclo es indirecto y con lag de semana.

**Riesgo:** Estados divergentes que se contradicen. No es un bug (ambos sistemas trabajan correctamente), pero crea complejidad para nuevas features.

---

## DT-02: Duplicación Estado `reputation`

**Cuatro campos de reputación en distintos sistemas:**

| Campo | Sistema | Consumidor |
|-------|---------|-----------|
| `state.career.reputation` | career.js | Ofertas laborales, sueldo inicial |
| `eco.manager.mediaReputation` | managerEcosystem | Multiplicador costos negociación |
| `world.reputation.leaguePrestige` | worldMediaPressure | UI display, worldMemory |
| `player.mediaReputation` | matchNarrative/worldMedia | ❌ Sin consumidor gameplay |

Solo los primeros dos tienen efectos mecánicos activos. El tercero es informativo. El cuarto es estado muerto (INC-02).

---

## DT-03: Overlap Economy/Prestige

**Prestige del club** calculado en tres lugares:
- `FMG_CLUB_DNA[id].prestige` (Fase 7, fijo)
- `eco.clubs[id].reputation` (managerEcosystem, dinámico)
- `worldEvolution.getDynastyBonus().prestige` (+8 para dynasties, no aplicado)

Conceptualmente son el mismo concepto con tres implementaciones. `eco.clubs[id].reputation` ya tiene lógica de crecimiento semanal y es lógico candidato a "fuente de verdad". `FMG_CLUB_DNA.prestige` sirve como valor base fijo. `getDynastyBonus().prestige` es un delta que nunca se aplica.

---

## DT-04: Hook Chain Fragility

**`FMG.runManagerEcosystemWeek` es wrapeado 6 veces:**
```
managerEcosystem.js (base)
  → worldMediaPressure.js (Fase 5a)
    → worldMediaPressure.js extension (Fase 5a ext)
      → managerEcosystem.js extension (Fase 5b ext)
        → squadPsychology.js extension (Fase 3+4)
          → advancedTransferMarket.js (Fase 6)
            → worldEvolution.js (Fase 8)
              → clubCulture.js (Fase 7)
```

**Riesgo:** El orden de carga de archivos determina la secuencia de ejecución. Si un archivo se añade o reordena en HTML, el comportamiento cambia silenciosamente. No hay sistema de registro de hooks ni prioridades.

**Mitigación actual:** Los wrappers son idempotentes (cada uno llama al anterior con `|| {}`). El orden actual funciona. El riesgo es para mantenimiento futuro.

---

# MATRIZ DE RIESGO

| ID | Problema | Impacto | Complejidad Fix | Riesgo Regresión | Archivos Afectados |
|----|----------|---------|-----------------|-----------------|-------------------|
| BUG-01 | boardTrust split | Alto | Bajo | Muy Bajo | worldMediaPressure.js, managerEcosystem.js |
| BUG-02 | homeAdvantageBonus dead | Medio | Bajo | Muy Bajo | worldMediaPressure.js |
| BUG-03 | inflation overwrite | Bajo-Medio | Muy Bajo | Bajo | advancedTransferMarket.js |
| BUG-04 | pressingIntensity | Bajo | Bajo | Bajo | matchEngine.js o humanFootballAI.js |
| INC-01 | dynastyBonus unused | Bajo | Bajo | Muy Bajo | worldEvolution.js |
| INC-02 | mediaReputation dead | Bajo | Medio | Bajo | advancedTransferMarket.js, playerProgression.js |
| INC-03 | combative→boardTrust | Alto | Bajo | Muy Bajo | (ver BUG-01, mismo fix) |
| INC-04 | mentorBondStrength | Muy Bajo | Bajo | Muy Bajo | squadPsychology.js |
| INC-05 | protector agent | Bajo | Bajo | Muy Bajo | advancedTransferMarket.js |
| UI-01..09 | UI Easy/Medium | Medio | Bajo-Medio | Bajo | ui/*.js |
| UI-10..12 | UI Hard (rutas) | Medio | Alto | Medio | gameState.js, main.js, ui/ |
| DT-01 | confidence duplication | Técnico | - | Bajo | - |
| DT-02 | reputation duplication | Técnico | - | Bajo | - |
| DT-04 | hook chain fragility | Técnico | - | Medio | - |

---

# SISTEMAS MUERTOS (Completos)

| Sistema | Declarado | Escrito | Leído | Estado |
|---------|-----------|---------|-------|--------|
| `eco.manager.boardTrust` | ❌ No inicializado | ✅ Por escándalos | ❌ Ningún consumidor | **Muerto** |
| `world.homeAdvantageBonus` | ✅ | ✅ Por fan reactions | ❌ Ningún consumidor match | **Muerto** |
| `player.mediaReputation` | ✅ (lazy) | ✅ Por hero/villain | ❌ No afecta valuaciones ni ofertas | **Muerto** |
| `mentorBondStrength` | ✅ | ✅ +1/semana | ❌ Penalización de salida es fija | **Muerto** |
| `getDynastyBonus().budgetMultiplier` | ✅ | ✅ (calculado) | ❌ Getter sin invocador | **Muerto** |
| `modifiers.pressingIntensity` | ✅ | ✅ ×0.95 | ❌ matchEngine no lo lee | **Muerto** |
| `adv.economy.inflationMultiplier` | ✅ | ✅ Por worldEvolution | ❌ FootballEconomyController no lo usa | **Muerto** |

---

# DUPLICACIÓN DE ESTADO

| Concepto | Estado 1 | Estado 2 | Estado 3 |
|----------|----------|----------|----------|
| Confianza jugador | `player.confidence` (match) | `emotions.confidence` (psych) | — |
| Board trust | `state.finances.boardTrust` ✅ | `eco.manager.boardTrust` ❌ | — |
| Home advantage | `cc.homeAdvantageModifiers` ✅ | `world.homeAdvantageBonus` ❌ | — |
| Prestige club | `FMG_CLUB_DNA.prestige` (fijo) | `eco.clubs.reputation` (dinámico) | `dynastyBonus.prestige` (no aplicado) |
| Reputación mgr | `career.reputation` ✅ | `eco.manager.mediaReputation` ✅ | — |
| Reputación jugador | `player.mediaReputation` ❌ | — | — |
| Inflación mercado | `adv.economy.inflation` ✅ | `adv.economy.inflationMultiplier` ❌ | — |

---

# RECOMENDACIÓN FINAL

## Estado actual por criterio

| Criterio | Estado |
|----------|--------|
| Tests 31/31 | ✅ |
| Determinismo (sin Math.random) | ✅ |
| Flujo principal jugable | ✅ |
| Sistemas de backend activos | ✅ (con excepciones BUG-01/02) |
| UI de nuevas features | ❌ 0% integración |
| Bugs críticos producción | ⚠ 4 bugs (2 con impacto significativo) |
| Deuda técnica | Manejable |

## Veredicto

**No listo para beta pública.** Listo para **alpha interna** con los siguientes criterios:

**Para alpha:**
- El flujo principal (seleccionar club, jugar temporada, mercado, partidos) funciona correctamente.
- Las Fases 1, 2 y 7 son funcionalmente completas con efectos mecánicos activos.
- Los sistemas de backend de Fases 3-9 generan estado correcto.

**Bloqueadores para beta:**
1. **BUG-01** (boardTrust): Escándalos sin efecto en despidos es confuso para usuarios.
2. **BUG-02** (homeAdvantageBonus): Fan reactions prometidas sin efecto.
3. **UI ausente**: 12 sistemas generan datos que el usuario nunca ve.
4. **Sin resolución de eventos**: Loyalty conflicts, press conferences y dressing room events existen pero el usuario no puede interactuar.

**Secuencia mínima para beta:**
1. Fix BUG-01 (2 líneas en worldMediaPressure.js)
2. Fix BUG-02 (redirigir homeAdvantageBonus a homeAdvantageModifiers)
3. UI-01 a UI-05 (fáciles, solo render de datos existentes)
4. UI-06 (press conferences interactivas — el único nuevo flujo UI crítico)

**Secuencia para early access:**
1. Todo lo anterior
2. BUG-03 y BUG-04
3. UI-07 a UI-09 (loyalty, timelines, documentaries)
4. INC-01 a INC-05

**Requiere refactor parcial:** No inmediatamente. La duplicación de estado (DT-01 a DT-04) puede vivir indefinidamente sin causar bugs, pero aumenta complejidad de mantenimiento.

**Unificación de estados:** Solo boardTrust requiere unificación urgente (BUG-01). El resto de las duplicaciones son tolerables en el corto plazo.

---

*Tests: 31/31 ✓ | Math.random: 0 violaciones ✓ | Bugs P0 verificados en runtime ✓*
