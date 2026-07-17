# REPORTE FASE 0 — Preparación del terreno

## Resumen por bloque

### Bloque 0 — Worktree fantasma
- Rescatados 2 archivos (`UI_LIFECYCLE_HARDENING_REPORT.md`, `uiLifecycleHardening.test.js`) → `../_rescatado_worktree/`
- Eliminado worktree `agents/constitutional-gerbil` con `git worktree remove --force`
- `git worktree list` → solo `main`

### Bloque A — Rama y limpieza
- Creada rama `fase0-preparacion`
- Creados `/docs/` y `/docs/legacy/`
- Movidos 4 documentos vigentes a `/docs/`
- Archivados ~75 reportes `.md`/`.txt` + `AUDIT_REPORTS/` + `LOADING_ORDER.FMG_CORE.html` a `/docs/legacy/`
- Eliminados `.eslintrc.json`, `assets/vendor/three.r128.min.js` y su `<script>` en `index.html`

### Bloque B — Eliminar phase15
- Eliminados `src/phase15/game.js`, `src/phase15/renderer.js`, `ui/phase15View.js`
- Cortadas referencias en `index.html`, `src/gameState.js`, `src/main.js`
- Renombrado `tests/phase15_16_17_smoke.test.js` → `tests/phase16_17_smoke.test.js` (sin phase15)

### Bloque C — Migración a Vite
- `npm install -D vite`
- `vite.config.js` con `base: './'`
- `index.html`: ~150 `<script>` tags → 1 `<script type="module" src="./src/boot.js">`
- `src/boot.js`: cadena de imports en orden de dependencias (154 módulos)
- CSP removido (incompatible con Vite HMR)
- `sw.js`: cache strategy actualizada para build Vite
- `electron/main.js`: apunta a `dist/index.html`
- `capacitor.config.json`: `"webDir": "dist"`
- `dev-server.js` archivado en `/docs/legacy/`

### Bloque D — Reorganización y renombrado
- Creadas carpetas: `/simulation/`, `/core/`, `/persistence/`, `/life/`, `/character/`, `/data/countries/`
- Motor 2D movido de `src/phase16-24/` a `/simulation/` con nombres semánticos
- Vistas `ui/phase16View.js`–`ui/phase24View.js` renombradas a nombres semánticos
- Tests renombrados (ver mapeo abajo)
- `matchVisualizer.js`/`matchVisualController.js` dejados en sitio (aún activos)

### Bloque E — SharedUniverse
- `npm install -D fake-indexeddb`
- `persistence/sharedUniverse.js`: API CRUD sobre IndexedDB
- `tests/sharedUniverse.test.js`: 6 tests de CRUD básico

## Tests

| | Antes | Después |
|---|---|---|
| Cantidad | 35 | 36 |
| Nuevo | — | `sharedUniverse.test.js` |
| Perdidos | — | 0 (phase15 se fusionó en smoke) |

## Mapeo de renombrado de tests

| Nombre viejo | Nombre nuevo | Sistema que prueba |
|---|---|---|
| `phase0.test.js` | `initialization.test.js` | Inicialización del juego (equipos, fixture) |
| `phase1.test.js` | `squad_management.test.js` | Gestión de plantel (once titular) |
| `phase2.test.js` | `match_engine.test.js` | Motor de partidos (estadísticas, resultado) |
| `phase2_architecture.test.js` | `state_architecture.test.js` | Arquitectura de estado (MatchState, UIState) |
| `phase3.test.js` | `live_match_flow.test.js` | Flujo de partido en vivo |
| `phase4.test.js` | `tactics_formation.test.js` | Sistema táctico/formaciones |
| `phase5.test.js` | `player_attributes.test.js` | Atributos de jugadores |
| `phase6.test.js` | `transfer_market.test.js` | Mercado de fichajes |
| `phase7.test.js` | `rival_ai.test.js` | IA rival |
| `phase8.test.js` | `competitions.test.js` | Competiciones |
| `phase9.test.js` | `finances_budgets.test.js` | Finanzas/presupuestos |
| `phase10.test.js` | `manager_profile.test.js` | Perfil del manager |
| `phase11.test.js` | `news_system.test.js` | Sistema de noticias |
| `phase12.test.js` | `club_identity.test.js` | Identidad de club |
| `phase13.test.js` | `settings_config.test.js` | Configuración |
| `phase15_16_17_smoke.test.js` | `simulation_engine_smoke.test.js` | Smoke test del motor 2D (engine + animation) |
| `phase19_22.test.js` | `simulation_broadcast_hud.test.js` | Sistema de broadcast/HUD/estadio/audio |
| `phase24.test.js` | `simulation_tactics.test.js` | Tácticas en cancha |

## Mapeo del motor

| Ubicación vieja | Ubicación nueva |
|---|---|
| `src/phase16/` | `simulation/engine/` |
| `src/phase17/` | `simulation/animation/` |
| `src/phase18/` | `simulation/ai/` |
| `src/phase19/` | `simulation/goalkeeper/` |
| `src/phase20/` | `simulation/broadcast/` |
| `src/phase21/` | `simulation/stadium/` |
| `src/phase22/` | `simulation/hud/` |
| `src/phase23/` | `simulation/audio/` |
| `src/phase24/` | `simulation/tactics/` |

## Desviaciones de la spec original

1. `matchVisualizer.js` y `matchVisualController.js` NO se archivaron (siguen activos y referenciados). Diferido a Fase 1.
2. CSP del index.html se eliminó para compatibilidad con Vite dev server; re-agregar en producción.
3. Los README de carpetas de dominio vacías se omitieron (solo `.gitkeep`).
4. Los nombres de funciones JS en vistas de simulación (`FMG.renderPhase16View` etc.) no se renombraron (solo cambiaron los nombres de archivo). Diferido a Fase 1 si se desea.

## Deuda técnica reconocida (para Fase 1)

### boot.js es una migración COSMÉTICA a Vite
- boot.js contiene 150 imports planos en orden secuencial forzado que replican el orden de los viejos `<script>` tags.
- Ningún módulo del juego usa `export`; todos usan el patrón `(function(){ const FMG = window.FMG = window.FMG || {}; ... })()`.
- Vite corre y el HMR funciona, pero el acoplamiento por variables globales sigue intacto. Mover un módulo o cambiar el orden puede romper todo.

### Impacto para Fase 1
Antes de agregar features nuevas (vertical slice del jugador, retrato por capas, life-sim), decidir con el usuario si la migración REAL a ES modules (import/export por módulo, eliminación de window.FMG.*) se hace como Fase 0.5 dedicada, o como primer bloque de Fase 1. Construir features encima del acoplamiento actual será cada vez más caro.

## Cierre de Fase 0

**Fecha de cierre:** 2026-07-16
**Estado final:**
- Tests: 36/36 ✅
- Build: OK (155 módulos, solo warning de chunk size 925 kB) ✅
- Bug corregido: `simulation/tactics/index.js:124-125` usaba `FMG` sin `window.` en strict mode, causando `ReferenceError`. El módulo explotaba al cargarse, impidiendo que `main.js` se ejecutara. Corregido: `window.FMG._loadedPhases`.

**Incidentes documentados:**
- Archivos rescatados del worktree: SÍ encontrados en `../_rescatado_worktree/` desde `Futbol/` (ambos archivos existen).
- boot.js cosmético: documentado como deuda técnica para Fase 1.
- SIMD-tactics/index.js: sin `window.` en `FMG._loadedPhases` — corregido.
- Otras rutas: no hay otros `fetch()` ni cargas de archivos de datos en el código. Solo 2 fetch en `src/main.js:71-72` a `./data/teams.json` y `./data/players.json`. Save/load usa `localStorage`.

**Pendientes formales que hereda Fase 1:**
- Evaluar test rescatado `uiLifecycleHardening.test.js` en `../_rescatado_worktree/`.
- Decidir archivo de `matchVisualizer.js`/`matchVisualController.js` en `docs/legacy/code-snapshots/`.
- Migración real a ES modules (boot.js estructural).
- Podar `runtimeHardening.js`.
- Integrar `sharedUniverse.js` al flujo del juego.
- CSP re-agregar para producción.
