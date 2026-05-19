# MOVEMENT HUMANIZATION REPORT

## Modelo de 5 capas

### Layer 1 — Posición táctica (base)
- `basePosition`: posición de formación asignada por el controlador
- Se actualiza en cada llamada a `moveTeamShape()` via `animatePlayerMove()`

### Layer 2 — Role Drift
- Cada jugador tiene fases `driftPhX/Z` y rates `driftRX/Z` únicos generados por `mulberry32(pid+"init")`
- Amplitudes: 0.9–2.0 m en X, 0.7–1.6 m en Z según el jugador
- Función: `sin(t * driftRX + driftPhX) * driftAX` — nunca sincronizado entre jugadores
- El drift es continuo e independiente de los eventos de partido

### Layer 3 — Micro-restlessness
- `_restX` = sin(t * restRate + restPh) * 0.7  →  movimiento de búsqueda de espacio
- `_restY` = cos(t * restRate * 0.72 + restPh) * 0.45  →  desplazamiento Y en pantalla
- Aplicado en `updateAnimations()` cada frame, antes del render
- Rate único por jugador: 0.55–1.45 Hz

### Layer 4 — Ball Awareness
- Radio de reacción: 18 m de campo
- **Atacantes (DEL/EXT)**: pull hacia el balón, fuerza proporcional a `(18 - dist) * 0.22`
- **Mediocampistas**: pull moderado `* 0.14`
- **Defensores**: oscilación de marcaje — offset en ángulo aleatorio determinista de 1.8 m
- GK: sin capa 4 (tiene su propio sistema de tracking)

### Layer 5 — Fatigue Instability
- Min 0–60: sin efecto
- Min 60+: `f = (minute - 60) / 30`, offsets `(rng() - 0.5) * f * 2.2` en X y Z
- Min 75+: factor f = 0.5, errores de ~1.1 m de radio
- Min 90: factor f = 1.0, errores de ~2.2 m de radio

### Resolución de colisiones
- Distancia mínima: 3.5 m de campo
- Push: `(minDist - dist) * 0.14` por iteración
- O(n²) sobre todos los pares — aceptable para n ≤ 22 jugadores
- Se ejecuta una vez por frame en `updateAnimations()`

### Portero (sistema independiente)
- Patrullaje: `sin(t * 0.55) * 4` m en X alrededor de `basePosition`
- Tracking del balón: `clamp(bdx * 0.18, -5, 5)` m en X
- Weight shift: `sin(t * 1.2) * 0.6` — visible como micro-movimiento
- Salida de línea: +2 m hacia el campo si el balón está en los últimos 20 m
- Velocidad urgente: duración 280 ms si ball está cerca, 680 ms si está lejos

### Sistema de stagger
- Cada `animatePlayerMove()` calcula un desfase por `mulberry32(pid+":stag:"+minute)`
- Rango: -25 a +65 ms extra en la duración de animación
- Resultado: los jugadores nunca llegan a su posición exactamente al mismo tiempo
