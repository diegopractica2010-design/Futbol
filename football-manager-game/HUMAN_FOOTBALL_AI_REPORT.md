# Human Football AI Report

Fecha: 2026-05-18

## Alcance

Se agrego `src/humanFootballAI.js` como capa emocional sobre el motor existente. No se reemplazaron `liveMatch.momentum`, `player.morale`, `profile.fatigue`, `FMG.computeTeamStrength` ni `FMG.advanceLiveMatch`; se extendieron con hooks pequenos en `src/matchEngine.js`.

## Archivos

- `src/humanFootballAI.js`
- `src/matchEngine.js`
- `src/tacticalIntelligence.js`
- `src/gameEngine.js`
- `index.html`

## Integracion

- `FMG.humanFootballAI.applyPreMatchModifiers(state)` se llama al inicio de `FMG.advanceLiveMatch`.
- `FMG.humanFootballAI.applyMinuteModifiers(state, context)` se llama antes de calcular eventos por minuto.
- `FMG.humanFootballAI.applyPostEventModifiers(state, event)` se llama para cada evento nuevo de `addLiveMinuteEvent`.
- `FMG.humanFootballAI.applyPostMatchModifiers(state)` actualiza confianza y fatiga mental al finalizar el partido.
- `FMG.computeTeamStrength` queda envuelto por la capa emocional cuando `humanFootballAI.js` carga despues de `matchEngine.js`.

## Estado Persistente

- `state.humanAI` guarda version, estado de partido, modificadores, performance y snapshot emocional.
- `player.confidence` persiste como valor 0-100 separado de `player.morale`.
- `player.mental_fatigue` persiste como valor 0-100 separado de energia/fatiga fisica.
- `saveSystem.js` no requirio cambios: el estado nuevo vive en el objeto serializado existente y se inicializa en migracion/revive.

## Determinismo

- No se introdujo `Math.random`.
- La variacion usa `FMG.hashText` y `FMG.mulberry32`.
- Los seeds derivan de `liveMatch.seed`, minuto, equipo y `player.id`.

## Verificacion

- `npx eslint src\humanFootballAI.js src\matchEngine.js src\tacticalIntelligence.js --max-warnings=0`: OK.
- `npm run lint`: OK con 59 warnings historicos preexistentes.
- `npm test`: bloqueado por warnings historicos porque el script usa `--max-warnings=0`.
- `node tests\run-all.js`: 28/31 pasan; fallan los mismos tests preexistentes:
  - `tests/phase0.test.js`: espera 13 equipos y los datos actuales tienen 16.
  - `tests/phase6.test.js`: jugador libre no puede firmar.
  - `tests/phase13.test.js`: temporada larga no inicia.
