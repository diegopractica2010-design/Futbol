# RELATIONSHIP SYSTEM REPORT
**Fase 3+4 — Relaciones Mentor/Protege y Facciones**
**Fecha:** 2026-05-19

## Sistema Mentor/Protegido

### Condiciones de Formación
- Veterano: age > 30, overall > 70, professionalism > 65
- Joven: age < 21
- Mismo grupo posicional (POR/DEF/MED/DEL)
- Relación existente en `psych.relationships[pairId]`

### Efectos Activos (semanal)
| Quién | Efecto |
|-------|--------|
| Protegido | `emotions.confidence += 0.5`, `emotions.motivation += 0.5` |
| Veterano | `legacyPoints += 3/36` (~3 pts por temporada) |
| Si mentor se va | Protegido: `confidence -= 8` por 1 semana |

### Estructura en psych.relationships
```javascript
psych.relationships[pairId] = {
  ...relacionExistente,
  mentorType: "mentor",
  mentorId: String,
  protegeId: String,
  mentorBondStrength: Number (0-100),
  startSeason: Number
}
```

## Sistema de Facciones

### Tipos de Facciones (máx 4)
| Tipo | Condición |
|------|-----------|
| `nationality` | 3+ jugadores misma nacionalidad |
| `young` | 3+ jugadores age < 22 |
| `veteran` | 3+ jugadores age > 30 |

### Efectos por Estado
| Condición | Efecto |
|-----------|--------|
| strength > 65 AND mood > 60 | `cohesion +5` |
| strength > 65 AND mood ≤ 60 | `cohesion -8`, genera evento `faction-conflict` |
| Dos facciones fuertes en conflicto | `cohesion -15`, `conflict +10` |

### Ciclo de Vida
- Facciones se crean automáticamente cuando se cumplen condiciones
- Se eliminan si sus miembros abandonan el club (< 3 miembros activos)
- `strength` crece 1pt por semana si mood > 60, baja 1pt si mood ≤ 60
- `mood` = promedio ponderado del morale de los miembros

## Sistema de Capitán Extendido

### state.psychology.captainId
Registrado cuando `FMG.setCaptain` se llama exitosamente.
También almacena: `captainAppointedWeek`, `captainAppointedSeason`, `captainSeasonsCount`.

### Efectos Activos
| Condición | Efecto Semanal |
|-----------|----------------|
| Capitán confidence > 70 | Todo el equipo: `motivation +3` |
| Capitán confidence < 40 | Todo el equipo: `morale -2` |
| Capitán ego > 75 | Evento `captain-speech` cada 4 semanas |
| 0-2 semanas desde nombramiento | Todo el equipo: `morale -2` (adaptación) |
| 3+ temporadas como capitán | `chemistry.cohesion +5` (leyenda) |
