# PLAYER PERSONALITY REPORT
**Fase 3+4 — Sistema de Personalidad de Jugadores**
**Archivo:** `src/squadPsychology.js` (extensión appended)
**Fecha:** 2026-05-19

## Sistema EGO (player.ego 0-100)

### Inicialización Determinista
```javascript
base = 30 + (overall * 0.4) + (age <= 24 ? 5 : age >= 32 ? -5 : 0)
ego = clamp(base + (hashText(id+"-ego") % 21) - 10, 0, 100)
```

### Comportamientos por Nivel

| Nivel | Efectos |
|-------|---------|
| ego > 75 | Demanda titularidad si 3+ semanas en banca; choca con otros ego > 75; genera eventos dressingRoom |
| ego < 30 | Acepta rotación; boostea motivación de compañeros (+1 cuando confidence > 65) |

### Evolución Semanal
- Ratio de starts < expectedStarts - 0.3: `ego -= 1`
- Confidence > 75 + goles > 1: `ego += 1`
- Benched 3+ semanas con ego > 75: genera evento `ego-clash`
- Clash inter-jugadores de alto ego: cada 3 semanas con seed determinista

## Sistema TOXICITY (player.toxicity 0-100)

### Acumulación
Sube cuando: `unhappy (happiness < 45) AND highEgo (ego > 65) AND lowTrust (managerTrust < 40)`
Delta: `+3` por semana cuando se cumplen todas las condiciones

### Efectos por Umbral

| Umbral | Efecto |
|--------|--------|
| > 60 | Evento "toxic-spread" en vestidor (cada 2 semanas) |
| > 80 | Baja morale a 2 compañeros cercanos (-5 cada uno) |
| > 90 | Solicitud de transferencia, `player.transferRequest = true` |

### Recuperación
- `toxicity -= 2` cuando el jugador está contento o managerTrust > 60
- Acciones del manager (reunion privada: -10, titularidad: -15)

## Separación de Atributos

| Atributo | Fuente | Propósito |
|----------|--------|-----------|
| `player.morale` | matchEngine.js | Rendimiento semanal |
| `psych.emotions.confidence` | squadPsychology.js | Psicología profunda |
| `player.confidence` | humanFootballAI.js | Modificadores de partido |
| `player.ego` | squadPsychology extended | Dinámica social |
| `player.toxicity` | squadPsychology extended | Conflicto vestuario |
