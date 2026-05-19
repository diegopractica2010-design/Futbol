# LEGENDARY MOMENT REPORT
**Fase 2 — Sistema de Momentos Legendarios**
**Fecha:** 2026-05-19

## Estado

`state.legendaryMoments[]` — máximo 50 entradas, gestionado por `boundedPush`.
Persistido automáticamente por `saveSystem.js` junto con `state`.

## Estructura de Momento

```javascript
{
  id: "legendary-{hash}",          // ID determinista único
  type: String,                     // Tipo de momento
  seasonNumber: Number,
  week: Number,
  description: String,              // Texto legible en español
  playerId: String | null,
  teamId: String,
  minute: Number,
  score_before: String | null,
  score_after: String               // "3-2"
}
```

## Tipos Detectados Automáticamente

### `last_minute_winner`
- **Trigger:** Gol en minuto ≥ 88
- **Descripción:** "[Jugador] anota en el minuto [N] para [Club] ([score])"

### `hat_trick`
- **Trigger:** Un jugador marca 3+ goles en el mismo partido
- **Descripción:** "[Jugador] marca hat-trick ([N] goles) en [Local] [score] [Visita]"

### `massive_comeback`
- **Trigger:** Equipo estaba 3+ goles abajo y no pierde
- **Descripción:** "[Club] remonta desde [N] goles abajo ([score_final])"

### `derby_decider`
- **Trigger:** Gol en minuto ≥ 85 en partido de rivalidad con resultado 1 gol diferencia
- **Descripción:** "[Jugador] decide el [NombreRivalidad] en el minuto [N] para [Club]"

## Anti-Duplicados

Cada momento usa ID determinista basado en `type + season + week + minute + teamId`. Si ya existe un ID igual, no se registra nuevamente.

## Integración con Fases Futuras

- **Fase 9 (legacyEngine):** Lee `state.legendaryMoments` para Hall of Fame y documentales
- **Fase 10 (playerCareerMode):** Los momentos legendarios del manager aumentan `legacyScore`
- **News.js:** Las noticias narrativas referencian momentos épicos

## Referencia en Noticias Futuras

El campo `description` está diseñado para ser citado en noticias futuras:
"El mismo estadio donde [description]..."
