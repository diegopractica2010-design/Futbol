# PERFORMANCE VALIDATION REPORT

## Lint
- Archivo: `src/matchVisualizer.js`
- Errores ESLint: **0**
- Warnings ESLint: **0**
- Comando: `npx eslint src/matchVisualizer.js`

## Tests
- Total: 31 tests
- Pasados: **28/31**
- Fallidos: 3 (phase0, phase6, phase13 — fallos pre-existentes de conteo de equipos, no relacionados)
- Comando: `node tests/run-all.js`

## Determinismo

### Entropía visual
Toda la aleatoriedad visual usa `mulberry32` + `hashSeed`:

| Sistema | Seed |
|---------|------|
| Textura del césped | `"pitch2025"` |
| Franjas de corte | `"stripes"` |
| Tribunas | `"crowd24"` |
| Propiedades de jugador | `playerId + "init"` |
| Role drift | Derivado del seed del jugador |
| Chaos por minuto | `playerId + ":chaos:" + Math.floor(min/2)` |
| Fatiga | `playerId + ":fat:" + Math.floor(min/4)` |
| Stagger de animación | `playerId + ":stag:" + minute` |
| Confetti de gol | `"goalfx" + round(x+y)` |
| Camera shake | `"camshake"` (fijo) |

**Math.random: 0 usos en todo el archivo.**

### Compatibilidad con replay
- Los offsets visuales son función de (playerId, minute) — mismo seed = mismo resultado
- El sistema de animación usa velocidades con inercia, no state aleatorio
- Los efectos de pantalla (flash, VAR) se triggean desde eventos del timeline, no de temporizadores externos

## Rendimiento estimado (browser)

| Componente | Costo por frame |
|-----------|----------------|
| Pitch (offscreen canvas) | ~0 (cache, 1 drawImage) |
| Tribunas (offscreen canvas) | ~0 (cache, 2 drawImage) |
| Jugadores (22 tokens) | ~0.3 ms |
| Balón + trail | ~0.1 ms |
| Partículas (máx 150) | ~0.2 ms |
| Camera transform | ~0 |
| HUD | ~0.1 ms |
| **Total estimado** | **< 1 ms/frame** |

Target: 60 fps en hardware moderno — sin spikes de CPU.

## Memory

- ParticlePool: límite estricto 150 partículas (`if (this.p.length >= this.max) return`)
- BallTrail: límite 14 puntos + TTL 200 ms
- FlowPaths: límite 8 entradas
- Offscreen canvases: 2 objetos, reconstruidos solo cuando cambia el tamaño
- Sin event listeners acumulados (cleanup en `dispose()`)
- Sin timers sin limpiar (solo `requestAnimationFrame` con ID guardado)

## API backward compat
Todos los métodos del contrato original están presentes y firmados igual.
`FMG.TacticalPitchRenderer`, `FMG.TacticalAnimationSystem`, `FMG.MatchVisualizer` exportados.
