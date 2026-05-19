# FOOTBALL DRAMA REPORT
**Fase 2 — Sistema de Drama Narrativo**
**Fecha:** 2026-05-19

## Drama en Noticias Post-Partido

Cuando `FMG.generatePostMatchNews` se llama, el sistema:

1. Llama `enrichResult(state, result)` que clasifica el arco y detecta momentos
2. Si el arco no es `standard`, genera un titular narrativo dramático con alta prioridad
3. Si hay un héroe identificado, genera noticia adicional de tipo `player-story`

### Templates de Drama por Arco

**Comeback (6 variantes):**
- "X rescribe la historia: remontar es posible"
- "Del abismo a la gloria: X no conoce la rendicion"
- "Epica remontada de X en la semana N"

**Collapse (6 variantes):**
- "X vivio un colapso historico ante Y"
- "De dominador a victima: el dia que X perdio el hilo"

**Thriller (6 variantes):**
- "Noche de fuego: golazo tras golazo sin respiro"
- "El futbol en su estado mas puro: A N-M B"

**Giant Killing (6 variantes):**
- "Terremoto en la tabla: X tumba a Y"
- "Nadie lo creyo pero X lo hizo: resultado historico"

## Determinismo

Selección de template: `hashText("narrative-{season}-{week}-{homeId}-{awayId}-{arc}") % templates.length`

Sin `Math.random()`. Reproducible con mismo seed de partida.

## Anti-Repetición

`dedupeKey: "narrative-{season}-{week}-{homeId}-{awayId}"` evita duplicados en la misma jornada. El sistema `headlineSimilarity` de news.js filtra repeticiones adicionales.

## Importancia de Noticias

| Arc | Importancia |
|-----|-------------|
| comeback, derby_classic, thriller | 90 |
| otros arcs dramáticos | 78 |
| player-story (héroe) | 75 |
