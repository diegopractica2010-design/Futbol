# Desperation Football Report

Fecha: 2026-05-18

## Activacion

La desesperacion se activa cuando un equipo va perdiendo y el partido supera el minuto 65. La severidad escala con:

- deficit de goles.
- tiempo restante.
- brecha de momentum.

## Efectos de Simulacion

- Frecuencia de tiro sube hasta `+25%`.
- Precision/efectividad de tiro baja hasta `-15%`.
- El equipo empuja lineas hacia adelante.
- El comportamiento de riesgo aumenta sin reemplazar las ordenes tacticas existentes.

## Efectos Visuales

`src/tacticalIntelligence.js` lee `liveMatch.humanAI`:

- `desperation`: comprime formacion hacia adelante.
- `positionError`: aumenta error de posicionamiento.
- `panic`: agrega desorden visual.
- Los jugadores tienden a agruparse cerca del balon cuando el equipo esta desesperado.

## Rivalry Aggression

Si `rivalries.js` detecta derby:

- Presion base aumenta.
- Faltas aumentan `+18%`.
- Ambos equipos arrancan con `+8` de confianza.
- Swings emocionales son `1.3x`.
- Local recibe bonus de fuerza por ambiente.
