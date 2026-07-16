# TRANSFER MARKET REPORT
**Fase 6 — Advanced Transfer Market Drama**
**Archivos:** `src/advancedTransferMarket.js` + `src/transfers.js`
**Fecha:** 2026-05-19

## Sistema 1 — Deadline Day Chaos

### Trigger
`state.market.windowOpen === true && advanced.economy.deadlinePressure >= 80`

El `deadlinePressure` ya era calculado por `FootballEconomyController.update` como porcentaje de la temporada transcurrida. Cuando supera 80, el mercado entra en modo deadline.

### Comportamientos

| Condición | Acción |
|-----------|--------|
| `deadlinePressure > 60` | Genera oferta de pánico (10% sobre valor) |
| `deadlinePressure > 80` | Oferta urgente (20% sobre valor) + noticia de última hora |
| Oferta rechazada en deadline | `generateDeadlineAngerEvent` → entry en `advanced.drama` + noticia "El fichaje que no fue" |

**Estructura de oferta de deadline:**
```javascript
{
  id, playerId, buyerTeamId, buyerTeamName, fee,
  status: "pending",
  week, deadlineOffer: true, urgent: true
}
```

**Integración:** `FMG.respondIncomingOffer` wrapeado — si se rechaza una `deadlineOffer`, activa automáticamente el evento de enojo.

---

## Sistema 2 — Broken Promises Active Effects

### Extensión del sistema existente
`ContractManagementSystem.evaluateBrokenPromises` ya detectaba promesas rotas. La extensión `checkBrokenPromisesExtended` añade consecuencias completas:

| Efecto | Valor |
|--------|-------|
| `player.confidence` | -15 |
| `psych.players[id].managerTrust` | -20 |
| `agent.relationship` | -25 |
| Si `ego > 70` | Noticia pública "Traicion en el vestuario" |

**Tipos de promesas detectadas:**
- `"minutos"` + starts < 2 después de 4 semanas → rota
- `"titular"` + squadRole === "bench" → rota
- `"no venta"` + player.teamId !== userTeamId → rota

### UI de Promesas Activas
```javascript
FMG.getActivePromises(state)
// → [{ id, playerId, playerName, text, week, seasonNumber, weeksActive }]
```

---

## Sistema 3 — Agent Active Behavior

Cada semana `runAgentWeeklyBehavior` itera los jugadores del plantel y aplica comportamiento según la personalidad del agente:

| Personalidad | Comportamiento Semanal |
|-------------|----------------------|
| `mediatico` | Genera rumor sobre su cliente (seed % 3 === 0) |
| `duro` | Si no contactado en 2+ semanas: `relationship -5`, evento en `drama` |
| `relacional` | Comparte info de clubs rivales (seed % 4 === 0) |
| `pragmatico` | Sugiere renovación cuando contrato ≤ 1 año |
| `protector` | (Bloqueo implementado via `loyaltyConflict` check) |

**Tracking de contacto:**
```javascript
advanced.agentContact = { [agentId]: lastContactWeek }
FMG.contactAgent(state, agentId) // registra contacto
```

---

## Sistema 4 — Loyalty Drama

### Trigger
`player.loyalty >= 70` + oferta entrante de club rival

### Flujo
1. `checkLoyaltyConflict` detecta el conflicto al generarse la oferta
2. Player: `morale -5`, `happiness -5`, estado conflicto interno 2 semanas
3. Noticia narrativa generada automáticamente
4. Manager decide via `FMG.resolveLoyaltyConflict(state, conflictId, decision)`

### Opciones del Manager

| Decisión | Efecto |
|----------|--------|
| `"match"` | Iguala oferta salarial (+15% salary), jugador queda contento |
| `"release"` | Venta con gracia, `career.reputation +5` |
| `"block"` | Jugador se queda pero `happiness -8`, `morale -5` por 3 semanas |

**Si no se decide en 2 semanas:** auto-resuelve como `"block"`.

### Estado persistido
```javascript
state.market.loyaltyConflicts = [{
  id, week, seasonNumber, playerId, playerName, offerId,
  offerFee, buyerTeamId, buyerTeamName,
  status: "pending" | "resolved" | "expired",
  decision: null | "match" | "release" | "block",
  conflictDuration
}]
```

### API
```javascript
FMG.getLoyaltyConflicts(state) // pendientes
FMG.resolveLoyaltyConflict(state, conflictId, "match"|"release"|"block")
```

---

## API Pública Completa

```javascript
// Consulta
FMG.getActivePromises(state)        // promesas vigentes del equipo
FMG.getLoyaltyConflicts(state)      // conflictos de lealtad pendientes

// Acciones
FMG.resolveLoyaltyConflict(state, id, decision)
FMG.contactAgent(state, agentId)    // cuenta como contacto para agentes "duro"

// Sistemas internos expuestos
FMG.TransferDramaExtended.generateDeadlinePanicOffer(state)
FMG.TransferDramaExtended.runAgentWeeklyBehavior(state)
FMG.TransferDramaExtended.checkBrokenPromisesExtended(state)
FMG.TransferDramaExtended.checkLoyaltyConflict(state, offer)
```

---

## Determinismo
Sin `Math.random()`. Todo determinista via `hashText`:

| Sistema | Seed |
|---------|------|
| Deadline panic offer | `"deadline-panic-{season}-{week}"` |
| Agent mediatico rumor | `"mediatico-{agentId}-{season}-{week}"` |
| Agent relacional info | `"relacional-{agentId}-{season}-{week}"` |
| Agent pragmatico suggest | `"pragmatico-{agentId}-{season}-{week}"` |
| Loyalty conflict ID | `deterministicId("loyalty-conflict", [season, week, playerId, buyerTeamId])` |

---

## Tests: 31/31 ✓
