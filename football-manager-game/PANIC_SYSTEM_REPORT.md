# Panic System Report

Fecha: 2026-05-18

## Triggers

El panico se activa cuando:

- Un equipo pierde por 2+ goles despues del minuto 60.
- El arquero acumula 2 errores aproximados en el partido.
- Un jugador estrella `overall > 75` se lesiona.

## Efectos

- Defensores apurados: se agrega hasta `+15%` a la chance de corner concedido.
- Arquero en duda: se aplica hasta `-10%` efectivo a la probabilidad de atajada mediante aumento de calidad rival.
- Mediocampistas pierden disciplina: `positionError` se expone en `liveMatch.humanAI`.

## Recuperacion

- Nivel inicial: 80.
- Decae 10 puntos por minuto.
- Recuperacion completa tras 8 minutos.

## Determinismo

Los modificadores por minuto usan seed derivado de:

- `liveMatch.seed`
- minuto
- lado/equipo
- `player.id` para errores visuales
