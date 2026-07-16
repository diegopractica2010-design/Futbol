# AUDITORÍA GENERAL — FASES 1-9
**Football Manager Chile**
**Fecha:** 2026-05-19
**Tests:** 31/31 ✓ | **Math.random:** 0 violaciones ✓ | **Lint:** 0 errores ✓

---

## PORCENTAJE COMPLETADO POR FASE

| Fase | Sistema | Lógica | Hooks | Persistencia | UI | Total |
|------|---------|--------|-------|-------------|-----|-------|
| 1 Human Football AI | ✓ | ✓ | ✓ | ✓ | Parcial | **95%** |
| 2 Match Narrative | ✓ | ✓ | ✓ | ✓ | N/A | **90%** |
| 3+4 Personality + Dressing Room | ✓ | Parcial | ✓ | ✓ | ✗ | **70%** |
| 5 Media & Pressure | ✓ | Parcial | ✓ | ✓ | ✗ | **72%** |
| 6 Advanced Transfer Market | ✓ | ✓ | ✓ | ✓ | ✗ | **80%** |
| 7 Club Culture | ✓ | ✓ | ✓ | ✓ | N/A | **95%** |
| 8 World Evolution | ✓ | Parcial | ✓ | ✓ | N/A | **82%** |
| 9 Legacy Engine | ✓ | ✓ | ✓ | ✓ | ✗ | **88%** |

**Estado general:** Motor del juego funcional. Mecánicas activas y deterministas. UI de nuevos sistemas completamente ausente.

---

# FASE 1 — HUMAN FOOTBALL AI (`src/humanFootballAI.js`)

## COMPLETO

- **Confidence Layer**: `player.confidence` (0-100) inicializado con varianza determinista por hash del ID. Persiste en `state.humanAI.players[id].confidence`.
- **Panic Logic**: `setPanic()` a nivel 80, `currentPanic()` decae -10/minuto, ventana de 8 min. Trigger automático: perdiendo 2+ goles después del min 60, 2+ errores portero, lesión estrella (overall>75).
- **Emotional Momentum**: `matchState.emotional[side]` con EMOTIONAL_GOAL_SURGE=20 (6 min), EMOTIONAL_SAVE_SURGE=12 (4 min), EMOTIONAL_MISS_DROP=15 (4 min). Multiplicador de rivalidad ×1.3 en derbis.
- **Desperation Football**: `desperationFor()` activa desde min 65 con déficit. Efectos: `pressureBonus +0.25×desp`, `shotQualityMultiplier × (1-0.15×desp)`, `positionError +1.8×desp`, `possessionShift ±3.5×desp`.
- **Rivalry Aggression**: Detecta rivalidad via `FMG.Rivalries.ensureRivalryState`. Derby: `pressureBonus +0.018`, `foulMultiplier ×1.18`, confidence +8 pre-partido.
- **Fatigue Psychology**: `player.mental_fatigue` separado de `player.energy`. >70: `strength -1.5`, `decision -0.03`, `positionError +1.4`. <30 (flow state): inverso. Recuperación -20/semana de descanso.
- **Hooks en matchEngine.js**: Todos verificados activos:
  - `applyPreMatchModifiers` → línea 489 matchEngine.js
  - `applyMinuteModifiers` → línea 124 (llamado por `addLiveMinuteEvent`)
  - `applyPostEventModifiers` → líneas 185-186 y 242-243
  - `applyPostMatchModifiers` → línea 530
- **FMG.computeTeamStrength wrapeado**: Flag `_humanAIWrapped`. Añade `sideStrengthBonus` = confidence/mental bonus + derby home bonus.
- **Determinismo**: Solo usa `FMG.mulberry32` y `FMG.hashText`. Cero `Math.random`.
- **Persistencia**: `state.humanAI = { version, players, team, matches, currentMatch }`. Cada partido tiene key = `seed|week|homeId|awayId`.

## PARCIAL

- **Visualizer integration**: `liveMatch.humanAI.positionError`, `liveMatch.humanAI.desperation`, `liveMatch.humanAI.panic` son SET correctamente. **No verificado** si `matchVisualizer.js` los lee para mostrar tokens con error de posición.
- **Complacency (-5% pressing)**: `pressingIntensity *= 0.95` cuando momentum gap > 60. Almacenado en `modifiers[side].pressingIntensity` pero **no verificado** si matchEngine aplica este modificador al perfil táctico.

## PROBLEMAS DETECTADOS

- `pressingIntensity` guardado en modifiers pero matchEngine solo lee `pressureBonus`, `shotQualityMultiplier`, `onTargetMultiplier`, `foulMultiplier`, `cornerBonus`, `savePenalty`, `possessionShift`, `strengthBonus`. **`pressingIntensity` nunca se aplica en el cálculo de presión**.

---

# FASE 2 — MATCH NARRATIVE (`src/matchNarrative.js`)

## COMPLETO

- **Story Arcs**: 8 tipos implementados: `derby_classic`, `boring_point`, `shutout_drama`, `giant_killing`, `thriller`, `comeback`, `collapse`, `standard`. Detección basada en reconstrucción del flujo de goles del timeline.
- **Hero/Villain**: Hat-trick > portero en 0-0 (3+ saves) > goleador decisivo. Villain: tarjeta roja en derrota > proxy de gol en propia (xg<0.05). Efectos: hero `confidence +12`, `mediaReputation +8`; villain `confidence -15`, `mediaReputation -10`.
- **Legendary Moments**: 4 tipos detectados: `last_minute_winner` (min≥88), `hat_trick` (3+ goles), `massive_comeback` (3+ goles déficit), `derby_decider` (min≥85, un gol diferencia). Bounded a 50 en `state.legendaryMoments`.
- **Dramatic Commentary**: 6 plantillas por arc (7 arcs × 6 = 42 plantillas). Selección determinista via `hashText`. `dedupeKey` por partido previene repetición en misma jornada.
- **Final Minute Narratives**: Wrap de `FMG.advanceLiveMatch` añade evento `type: "narrative"` al timeline en min≥85. Tres variantes: empate, un gol diferencia, equipo usuario perdiendo. Anti-duplicado por minuto.
- **Integración con news.js**: Noticias de arc (importance 90 para comeback/thriller/derby) y hero generadas via `FMG.addNewsItem`. `dedupeKey` único. Wrap correcto de `FMG.generatePostMatchNews`.
- **Persistencia**: `state.legendaryMoments` inicializado lazy en `ensureLegendaryMoments`. `deterministicId` previene duplicados.

## PARCIAL

- **Anti-repeat headlines**: Usa `dedupeKey` por partido pero NO usa el `headlineSimilarity` existente de `news.js` para los titulares narrativos generados por templates. El sistema de news.js sí llama `chooseHeadline` (que usa similarity) para el `chronicle` original, pero la noticia narrativa adicional tiene título fijo sin pasar por esa validación.

## PROBLEMAS DETECTADOS

- Ninguno crítico. Fase funcionalmente completa.

---

# FASE 3+4 — PERSONALITY + DRESSING ROOM (`src/squadPsychology.js` — extensión IIFE)

## COMPLETO

- **Ego System**: `ensureEgo()` formula determinista (`30 + overall×0.4 + age bonus`). Actualización semanal: startRatio vs expectedStarts, confidence+goals. Genera evento `ego-clash` cuando ego>75 + benched 3+ semanas. Choque inter-egos cada 3 semanas.
- **Factions**: `detectFactionFormation()` detecta grupos por nacionalidad (3+ miembros), jóvenes (<22) y veteranos (>30). `updateFactions()` afecta `psych.chemistry.cohesion` (±5/-8/-15). Genera evento `faction-conflict`.
- **Mentor/Protege**: `detectMentors()` revisa age>30, overall>70, professionalism>65, mismo grupo posicional, relación existente. `updateMentorEffects()`: protegido +0.5 confianza/motivación semanal, mentor +3/36 legacy points. Genera evento `mentor-bond`.
- **Toxicity**: `updateToxicity()` con acumulación por unhappy+highEgo+lowTrust (+3/semana). Umbrales: >60 evento cada 2 semanas, >80 spread morale -5 a 2 compañeros, >90 `player.transferRequest = true`.
- **Captain Influence**: Usa `state.psychology.captainId` (establecido en `FMG.setCaptain` wrappeado). confidence>70 → motivation+3 a todo el equipo, confidence<40 → morale-2. ego>75 → evento cada 4 semanas. 2 semanas adaptación → morale-2. 3+ temporadas → cohesion+5.
- **Dressing Room Events**: `addDressingRoomEvent()` con dedupeKey determinista. Bounded a 20. Tipos: ego-clash, faction-conflict, mentor-bond, toxic-spread, captain-speech, leadership-void.
- **`runExtendedPsychologyWeek`**: Invocado desde `FMG.runManagerEcosystemWeek`. Corre todos los sistemas en orden.
- **Persistencia**: `state.dressingRoomEvents` (inicializado en `ensureDressingRoomEvents`, lazy), `player.ego`, `player.toxicity` en player objects, `state.psychology.captainId/captainAppointedWeek/captainSeasonsCount`.

## PARCIAL

- **`mentorBondStrength`**: Incrementa +1/semana, capped a 100, **nunca leído** para efecto alguno. Acumulador sin payoff.
- **Faction check miembros**: `detectFactionFormation` no verifica si miembros abandonaron el club antes de crear la facción. `updateFactions` sí filtra los IDs activos pero `detectFactionFormation` puede crear facciones con miembros ya vendidos.
- **Toxicity spread**: Hardcodeado a `slice(0, 2)` — siempre afecta a los primeros 2 jugadores del array, no a los más cercanos ni compañeros de posición.

## FALTANTE

- **UI de resolución de eventos**: Las `choices` en cada evento de vestuario son datos declarados con `label` y `effect`, pero **no existe `FMG.resolveDressingRoomEvent()`** ni UI que los aplique. Los efectos de las choices (`{ egoPlayer: -5, managerTrust: 3 }`) son descriptivos, no ejecutables.
- **Integración en weekly summary screen**: El spec requiere mostrar eventos en pantalla de resumen semanal. `state.dressingRoomEvents` existe, pero **ninguna ruta ni componente de `main.js` o `presentation.js` los renderiza**.

## RIESGOS

- Sin mecanismo de resolución, los eventos acumulan hasta 20 y se descartan (FIFO via `boundedPush`). Los jugadores con toxicidad alta generan eventos cada 2 semanas sin consecuencias adicionales.

---

# FASE 5 — MEDIA & PRESSURE (`src/worldMediaPressure.js` + `src/managerEcosystem.js` — extensiones)

## COMPLETO

- **Interactive Press Conferences**: `PRESS_QUESTIONS` con 4 topics (táctica/mercado/presión/vestuario) × 2-3 preguntas × 3 tonos. `addQuestionsToConference()` auto-puebla. `FMG.answerPressConference()` aplica efectos de tono: diplomatic (+5 fans, +5 media, -3 playerTrust), combative (-5 fans, -8 media, +6 playerTrust, riesgo escándalo). Historial en `state.career.pressConferenceHistory` (bounded 20).
- **Scandal System**: `addScandal()` bounded a 8. Triggers: conflict>80 (fracción de seed), toxicity>85 (player público), respuesta combativa + mal momento. Efectos por severidad: 1→boardTrust (eco) -5, 2→boardTrust -12 + fans.pressure+8 + noticia, 3→morale equipo -15. `resolveOldScandals()` auto-resuelve en 4/6/8 semanas.
- **Hero/Villain Media**: `trackHeroVillainMedia()` lee `result.matchHero/matchVillain` (Fase 2). Hero: `mediaReputation+5`, noticia, a 3+ créditos "golden-boy" + `ego+10`. Villain: `mediaReputation-8`, noticia negativa, a 3+ créditos `toxicity+15` + noticia "problem player".
- **Fan Reactions**: `addFanReaction()` bounded a 10. Triggers: racha 4+ victorias, racha 3+ derrotas, victoria derby, venta figura, fichaje importante. `applyFanReactionEffect()`: positivo → `homeAdvantageBonus+8` (2 semanas), negativo → `morale -5` + `manager.pressure+10`.
- **Press Conference auto-trigger**: Cada 3 semanas, losing streak 3+, rumor activo. Agrega preguntas a conferencias existentes sin ellas.
- **Persistencia**: `state.scandals`, `state.fanReactions`, `state.career.pressConferenceHistory` todos inicializados correctamente.

## PARCIAL

- **Conference triggers en weekly flow**: Llamado desde `FMG.runManagerEcosystemWeek` de managerEcosystem.js extension. Pero si la extensión de `worldMediaPressure.js` se carga DESPUÉS, ambas envuelven `runManagerEcosystemWeek` en cadena. La cadena funciona, pero el orden de carga del archivo determina qué extensión actúa antes.
- **Scandal `resolveOldScandals`**: Sólo marca `resolved = true` sin aplicar ningún efecto de recuperación (boardTrust no sube al resolverse).

## PROBLEMAS CRÍTICOS DETECTADOS

### `eco.manager.boardTrust` ≠ `state.finances.boardTrust` — CONEXIÓN ROTA
El sistema de escándalos escribe en `eco.manager.boardTrust`. El sistema de despido (career.js) lee `state.finances.boardTrust`. Son dos campos DISTINTOS. Los escándalos afectan un campo que el sistema de despido **nunca lee**. El escándalo de severidad 2 que debería costar "-12 board trust" al directorio **no tiene efecto en la posibilidad real de despido**.

### `homeAdvantageBonus` (fan reactions) — ESTADO MUERTO
`world.homeAdvantageBonus` (en `managerEcosystem.worldMedia`) se incrementa cuando hay reacción positiva de fans, pero **ningún sistema de matchEngine ni de computeTeamStrength lo lee**. `clubCulture.js` usa su propio `state.clubCulture.homeAdvantageModifiers` (diferente campo, diferente objeto). El bonus de home advantage de las fan reactions nunca llega al partido.

## FALTANTE

- **Dashboard "Pulso de la hinchada"**: Dato disponible en `state.fanReactions`, pero ninguna ruta ni componente lo renderiza.
- **Resolución de conferencias de prensa en UI**: `FMG.answerPressConference` existe como API, pero no hay ruta en `main.js` ni componente en `presentation.js` que la invoque.

---

# FASE 6 — ADVANCED TRANSFER MARKET (extensiones en ambos archivos)

## COMPLETO

- **Deadline Day**: `isDeadlineWeek()` basado en `deadlinePressure >= 80`. `generateDeadlinePanicOffer()` crea oferta en `market.incomingOffers` con `deadlineOffer: true`, premium 1.1-1.2×. `generateDeadlineAngerEvent()` genera entrada en `advanced.drama` + noticia "El fichaje que no fue" cuando se rechaza oferta de deadline. Detectado en wrap de `FMG.respondIncomingOffer`.
- **Broken Promises Full Consequences**: `checkBrokenPromisesExtended()` detecta 3 tipos de promesas (minutos/titular/no-venta). `applyBrokenPromiseFullConsequences()`: `confidence -15`, `psych.players[id].managerTrust -20`, `agent.relationship -25`. Si ego>70: noticia pública.
- **Agent Active Behavior**: `runAgentWeeklyBehavior()` cada semana:
  - `mediatico`: rumor en noticias (1 de cada 3 semanas)
  - `duro`: `adv.agentContact` tracking, -5 relationship si ignorado 2+ semanas, evento en drama
  - `relacional`: insider info sobre club rival (1 de 4 semanas)
  - `pragmatico`: sugiere renovación si contrato ≤ 1 año
- **Loyalty Drama**: `checkLoyaltyConflict()` activa cuando loyalty≥70 + oferta entrante. 2 semanas de conflicto. `FMG.resolveLoyaltyConflict()` tres rutas: match (salary×1.15), release (reputation+5), block (happiness-8, morale-5). Auto-expira a "block" si no se resuelve.
- **UI APIs**: `FMG.getActivePromises(state)`, `FMG.getLoyaltyConflicts(state)`, `FMG.contactAgent(state, agentId)` implementados en `transfers.js` extensión.
- **Persistencia**: `state.market.loyaltyConflicts` (bounded 10), `advanced.agentContact`, `advanced.contracts.brokenPromises`.

## PARCIAL

- **Protector agent**: Declarado en el spec pero sin implementación activa. Los otros 4 personajes (mediatico/duro/relacional/pragmatico) tienen comportamiento. Protector tiene solo la descripción en los datos del agente pero `runAgentWeeklyBehavior` no tiene caso para "protector".
- **Turn-based countdown**: El spec menciona "1 day = 1 action" countdown para deadlines. Implementado como check semanal (deadlinePressure >= 80), no como countdown por turnos granular.

## FALTANTE

- **UI de loyalty conflicts**: `FMG.getLoyaltyConflicts(state)` existe pero **no hay ruta ni componente** que lo renderice para que el usuario resuelva el conflicto.
- **UI de promesas activas en player detail**: `FMG.getActivePromises(state)` existe pero no se usa en `presentation.js`.
- **Transfer inbox "agent actions"**: Los agentes generan drama entries pero no hay "agent inbox" visible al usuario.

---

# FASE 7 — CLUB CULTURE (`src/clubCulture.js`)

## COMPLETO

- **Club DNA**: `FMG_CLUB_DNA` define los **16 clubes chilenos** (incluye los 3 adicionales más allá de los 13 originales del spec). Campos: identity, tacticalDNA, fanExpectation, prestige, traditionsKey.
- **Stadium Data**: `FMG_STADIUM` define los **16 estadios** con capacity, passionRating (58-95), intimidationFactor (5-14).
- **Fan Expectation Pressure**: `getPressureLevel()` mapea expectativa vs posición a crisis/concern/fear/ok. Efectos semanales: boardTrust (-4 a -8), morale equipo (-2 a -4). Genera noticia en crisis/fear.
- **Stadium Atmosphere**: `FMG.computeTeamStrength` wrapeado (flag `_cultureWrapped`, preserva `_humanAIWrapped`). `stadiumStrengthBonus()` añade `intimidationFactor × 0.1` cuando el equipo juega de local. `cc.homeAdvantageModifiers[teamId]` como bonus adicional (post-derby, tradiciones).
- **Derby Culture**: `findNextUserFixture()` detecta próximo partido. Si derby en siguiente semana: `applyPreDerbyEffects()` (manager.pressure+12, media.pressure+15, morale+3, noticia). `applyPostDerbyEffects()` vía wrap de `generatePostMatchNews`: victoria (boardTrust+8, homeAdvantageModifiers+3, morale+10), derrota (inverso).
- **Traditions**: `processTraditions()` detecta 8 tipos de tradiciones, dispara 1 vez/temporada via `deterministicId`. Efectos: morale-boost, home-boost, media-boost, fan-approval.
- **Persistencia**: `state.clubCulture = { pressureByTeam, derbyWeek, postDerby, activeTraditions, homeAdvantageModifiers }`.

## FALTANTE

- **Spec menciona "13 clubs"** — implementado para los 16 actuales (correcto dado expansión de datos).
- **"Club Identity section of dashboard"** para tradiciones activas — dato en `state.clubCulture.activeTraditions` pero no renderizado.

## RIESGOS

- `postDerby[uid]` expira correctamente en `expirePostDerbyEffects`, pero si hay dos derbis en la misma temporada el segundo sobreescribe el primero. Puede causar loss de efectos.

---

# FASE 8 — WORLD EVOLUTION (`src/worldEvolution.js`)

## COMPLETO

- **Dynasties**: `updateDynasties()` trackea `consecutiveTitles` por club. `isDynasty = true` en 3+. Genera noticias de inicio/fin. `getDynastyBonus()` retorna prestige+8, budgetMultiplier×1.12. `applyDynastyMotivation()` da morale+5 al equipo del usuario semana antes del partido contra un club dinasta.
- **Fallen Giants**: `updateFallenGiants()` verifica prestige≥80 (via `FMG.ClubCulture.DNA`). Acumula `badSeasons` cuando club termina en mitad baja. Status="fallen" a 3+ temporadas. `triggerFallenGiantBudgetCrisis()`: para user team: balance-30%, transfers budget-15%. Para cualquier club: 2 jugadores clave con `transferRequest=true`, `happiness-12`. Noticia automática.
- **Golden Generations**: `updateGoldenGenerations()` identifica top-10 por overall, filtra <26 años, agrupa por club. 3+ del mismo club → "golden_generation". Para equipo usuario: `fans.pressure-10`.
- **Tactical Eras**: `detectDominantTactic()` revisa top-6 de standings via `FMG.sortStandings`. `updateTacticalEras()` activa era tras 2 temporadas consecutivas del mismo estilo. `getTacticalEraSurpriseBonus()` retorna +3 para estilo diferente, -2 para mismo estilo.
- **Economic Cycles**: `computeEconomicPhase()` determinista: `hashText("econ-cycle-" + seed + "-" + floor((season-1)/4)) % 3`. Fases: boom (inflation×1.15, budgets+15%), neutral, crisis (×0.88, -12%). `applyBudgetCycleEffects()` modifica `state.rivalAI.budgets` y `state.finances.balance` en `startNewSeason`.
- **Hooks**: `FMG.evaluateCareerSeasonEnd` wrapeado, `FMG.startNewSeason` wrapeado, `FMG.computeTeamStrength` wrapeado (`_evolutionWrapped`), `FMG.runManagerEcosystemWeek` wrapeado (dynasty motivation semanal).
- **Persistencia**: `state.worldHistory = { dynasties, fallenGiants, goldenGenerations, tacticalEras, economicCycle, worldEvents }`.

## PROBLEMAS DETECTADOS

### Economic cycle inflation — EFECTO TRANSITORIO
`updateEconomicCycle()` aplica `advanced.economy.inflation × inflationMultiplier` una vez al fin de temporada. Sin embargo, `FootballEconomyController.update()` (en advancedTransferMarket.js línea 178) **recalcula inflation desde cero** cada semana: `inflation = clamp(1 + momentum/180 + ..., 0.86, 1.42)`. El multiplicador del ciclo económico es sobreescrito en la primera semana de la nueva temporada. **Solo los efectos de presupuesto (AI budgets + user balance) son permanentes**.

## RIESGOS

- `getDynastyBonus()` retorna `budgetMultiplier: 1.12` pero este valor **nunca es leído ni aplicado** en ningún lugar del código (no está en transfer market, no en season start budget). Es un getter de datos sin consumidor.

---

# FASE 9 — LEGACY ENGINE (`src/legacyEngine.js`)

## COMPLETO

- **Hall of Fame**: `checkHallOfFame()` verifica 4 condiciones: títulos misma club≥3, goals≥50, appearances≥150, seasonsAbove80≥5. `inductionReason` priorizado. Genera noticia para user team. Añade a `clubTimeline`. Bounded a 100.
- **Career Records**: `updateCareerRecords()` compara con 4 récords: `topScorer`, `mostAppearances`, `highestOverall`, `mostTitles`. Genera noticia si se rompe el de máximo goleador.
- **Club Timelines**: `syncClubTimelines()` lee `wh.dynasties`, `wh.fallenGiants`, `state.legendaryMoments` (filtrado por season), e induciones HoF. También añade el campeón de cada temporada. Bounded a 30 por club. `addToClubTimeline()` con dedupeKey determinista.
- **Manager Legacy**: `computeManagerLegacy()` formula: `(títulos×12) + (temporadas×3) + (clubes×2) + (momentos×8) + (hofPlayers×15)`. Labels: 0-20 "Pasajero", 21-40 "Recordado", 41-60 "Leyenda local", 61-80 "Idolo eterno", 81-100 "Monumento vivo".
- **Documentary Generation**: `generateSeasonDocumentary()` genera 3 párrafos: posición/campeón/contexto dinasta, momentos legendarios de la temporada, drama de vestuario/escándalos + legacyLabel. Bounded a 10. Deduplicado por temporada+equipo.
- **Career stats accumulation**: `accumulateCareerStats()` corre ANTES del reset de `seasonStats`, capturando goals/appearances/seasonsAbove80/peakOverall/titles. Persiste en `state.legacy.playerCareerStats`.
- **Hook**: `FMG.evaluateCareerSeasonEnd` wrapeado. Corre DESPUÉS de worldEvolution.js (chain correcta).
- **Persistencia**: `state.legacy = { hallOfFame, allTimeRecords, playerCareerStats, clubTimelines, managerLegacy, seasonDocumentaries }`.

## FALTANTE

- **Historia Épica en career view**: El spec requiere "nueva sección 'Historia Épica' en career view". `state.legacy.hallOfFame`, `state.legacy.seasonDocumentaries` y `LegacyEngine.getClubTimeline()` existen pero **no hay ruta `/history` ni `/hall-of-fame` en `FMG.ROUTES`** (gameState.js), ni componente en `main.js` o `presentation.js`.
- **Notificación "Record roto en Temporada X"**: Solo implementada para `topScorer`. Los otros 3 records se actualizan silenciosamente.

---

# VALIDACIONES GLOBALES

## NO uso de Math.random
✅ **CERO VIOLACIONES** — Búsqueda exhaustiva en todos los archivos de fase. Solo `FMG.rng()`, `FMG.hashText()`, `FMG.mulberry32()`, `FMG.randomInt()` (seeded).

## Persistencia save/load
✅ `saveSystem.js` usa `JSON.stringify(state)` en `cloneForPersistence()`. Todos los nuevos estados son objetos JSON planos: `state.humanAI`, `state.legendaryMoments`, `state.dressingRoomEvents`, `state.fanReactions`, `state.scandals`, `state.market.loyaltyConflicts`, `state.clubCulture`, `state.worldHistory`, `state.legacy`. La serialización es automática y completa.

## Hooks correctos (cadena de wraps)
✅ La cadena de wraps de `FMG.runManagerEcosystemWeek` (6 wraps en total) y `FMG.generatePostMatchNews` (5 wraps) y `FMG.evaluateCareerSeasonEnd` (3 wraps) funcionan correctamente. Cada wrapper llama al anterior y ninguno tiene ciclos.

## Sistemas duplicados
⚠ **`FMG.setCaptain` wrapeado dos veces**: Una en el IIFE base de squadPsychology.js (líneas 398-407) y otra en la extensión (que envuelve la primera). La cadena funciona pero genera doble registro en psychology. No es un bug, pero es redundante.

## Código muerto
- `modifiers[side].pressingIntensity` en humanFootballAI.js — calculado, almacenado en `liveMatch.humanAI.modifiers`, pero matchEngine no lo lee.
- `mentorBondStrength` en psych.relationships — incrementado semanalmente, nunca leído.
- `eco.manager.boardTrust` en escándalos — escrito pero no conectado a `finances.boardTrust`.
- `getDynastyBonus().budgetMultiplier` — getter sin consumidor.
- `world.homeAdvantageBonus` (fan reactions) — escrito pero no leído por match calculations.
- `advanced.economy.inflationMultiplier` — almacenado en state pero sobreescrito cada semana.

## UI faltante (sistemas sin render)
Todos los siguientes sistemas tienen datos completos y correctos en state, pero **CERO integración con main.js o presentation.js**:
- `state.dressingRoomEvents` — Weekly summary events
- `state.fanReactions` — "Pulso de la hinchada" dashboard
- `state.scandals` — No hay sección de escándalos activos
- `state.market.loyaltyConflicts` — No hay UI para resolver
- `state.career.pressConferenceHistory` — No renderizado
- Press conference choices — `FMG.answerPressConference` no invocado desde UI
- `state.legacy.hallOfFame` — No hay ruta `/hall-of-fame`
- `state.legacy.seasonDocumentaries` — No hay ruta `/history`
- `state.legacy.clubTimelines` — No hay Club view con timeline
- `state.clubCulture.activeTraditions` — No renderizado en dashboard

---

# RESUMEN FINAL

## Faltantes Críticos (afectan mecánicas del juego)

1. **`eco.manager.boardTrust` desconectado de `state.finances.boardTrust`** — Escándalos no afectan la posibilidad real de despido.
2. **`world.homeAdvantageBonus` sin consumidor** — Fan reactions home advantage no llega a los partidos.
3. **Ciclo económico de inflación transitorio** — `FootballEconomyController.update()` sobreescribe la modificación de ciclo económico cada semana; solo los efectos de presupuesto persisten.
4. **`pressingIntensity` nunca aplicado** — Complacency mechanic declarada pero sin efecto en matchEngine.

## Faltantes Menores (funcionalidad declarada, sin efecto)

5. **`getDynastyBonus().budgetMultiplier`** — Calculado pero nadie lo aplica.
6. **`mentorBondStrength`** — Incrementado semanalmente sin payoff.
7. **Agente "protector"** — Sin comportamiento activo semanal.
8. **Toxicity spread** — Hardcodeado a primeros 2 jugadores, no a compañeros más relacionados.
9. **Resolución de escándalos** — Solo marca `resolved=true`, sin recuperación de boardTrust.
10. **Notificaciones de records rotos** — Solo implementado para top scorer.

## UI Completamente Ausente

11. **Vestuario / dressing room events** — Sin resolución de choices, sin pantalla.
12. **"Pulso de la hinchada"** — `state.fanReactions` sin render.
13. **Conferencias de prensa interactivas** — `FMG.answerPressConference` sin invocación desde UI.
14. **Conflicts de lealtad** — `FMG.resolveLoyaltyConflict` sin acceso desde UI.
15. **Hall of Fame / Historia** — Sin rutas en `FMG.ROUTES`, sin vistas.
16. **Documentales de temporada** — Sin ruta ni render.
17. **Promesas activas en jugador** — `FMG.getActivePromises` sin uso en presentation.
18. **Tradicones activas en dashboard** — Sin render.

## Dependencias Rotas Entre Fases

- **Fase 5 → Fase 3+4**: `trackHeroVillainMedia` lee `result.matchHero` (Fase 2) correctamente. ✅
- **Fase 5 escándalo → Fase 3+4 toxicidad**: `checkScandalTriggers` lee `player.toxicity` (Fase 3+4) correctamente. ✅
- **Fase 6 → Fase 3+4**: `applyBrokenPromiseFullConsequences` lee `state.psychology.players[id].managerTrust` correctamente. ✅
- **Fase 7 → matchEngine**: `computeTeamStrength` chain funcionando. ✅
- **Fase 8 → Fase 7**: `getClubPrestige` / `getClubTacticalDNA` dependen de `FMG.ClubCulture.DNA` — si clubCulture.js no carga antes, retorna defaults. Dependencia de orden de carga de archivos (runtime). ⚠
- **Fase 9 → Fase 8**: `syncClubTimelines` lee `state.worldHistory` correctamente. ✅
- **Fase 9 → Fase 2**: `syncClubTimelines` lee `state.legendaryMoments` correctamente. ✅
- **Fase 5 escándalos → career.js**: `eco.manager.boardTrust` != `state.finances.boardTrust`. ❌ ROTO

## Fases Listas para Producción (lógica completa, efectos activos)

- ✅ **Fase 1** — Human Football AI (todos los modificadores activos en match)
- ✅ **Fase 2** — Match Narrative (arcs, hero/villain, legendary moments, news)
- ✅ **Fase 7** — Club Culture (DNA, stadium atmosphere, derby, traditions)

## Fases Con Mecánicas Activas Pero UI Pendiente

- ⚠ **Fase 3+4** — Sistemas activos, UI de resolución de eventos ausente
- ⚠ **Fase 5** — Conferencias y escándalos activos, UI ausente; homeAdvantage roto
- ⚠ **Fase 6** — Deadline, agentes, loyalty drama activos; UI de resolución ausente
- ⚠ **Fase 8** — Dynasties/fallen giants/golden gen activos; inflation cycle parcial
- ⚠ **Fase 9** — Todos los sistemas activos; vistas de historia ausentes

---

*Tests: 31/31 ✓ | Lint: 0 errores ✓ | Math.random: 0 violaciones ✓*
