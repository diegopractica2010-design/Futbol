# Auditoría Fase 0 — Repositorio Futbol

**Fecha:** 2026-07-16 · **Marco de referencia:** GDD_Football_Life.docx v1.0 · **Auditor:** Claude (solo lectura)

## 1. Resumen ejecutivo

- Total archivos auditados: **297** (alcance: todo lo versionado excepto `node_modules/`, `.git/`, `AUDIT_REPORTS/`)
- CONSERVAR: **135** (45.4%)
- ADAPTAR: **82** (27.6%)
- ARCHIVAR: **78** (26.3%)
- ELIMINAR: **2** (0.7%)
- Estado de tests al iniciar: **35/35 pasando** (`node tests/run-all.js`, ejecutado 2026-07-16)
- Riesgos altos detectados:
  - **Dos motores visuales de partido conviven**: `src/matchVisualizer.js` (integrado al SPA vía `matchVisualController`) y la cadena `src/phase16 → phase24` (más moderna, pero solo accesible como sandbox en modo dev). Hay que elegir uno como canónico antes de la Fase 1 (ver sec. 5).
  - **Doble simulador estadístico**: `src/matchEngine.js` (activo, usado por `gameEngine`) duplica rol con `src/FMG.Core/Services/MatchSimulator.js`.
  - **Nombres reales de clubes y rivalidades** en `data/teams.json`, `src/presentation.js` y `src/news.js`: bloquean publicación legal hasta ficcionalizar (GDD 11.1, planificado Fase 9).
  - **600 KB de Three.js muerto** cargados en cada arranque (`index.html:34`) sin una sola referencia en el código.
  - La migración a Vite (Fase 0) toca `index.html`, `main.js`, `sw.js`, `dev-server.js` y `electron/main.js` a la vez: hacerla con los tests como red de seguridad.

## 2. Tabla de decisión (completa)

| Ruta | Líneas | Etiqueta | Motivo (1 frase) | Notas |
|---|---|---|---|---|
| .eslintrc.json | 42 | **ELIMINAR** | Config ESLint legacy duplicada; ESLint 9 usa eslint.config.js (formato flat) y la ignora. | Ningún proceso la lee; el lint pasa con eslint.config.js |
| .gitignore | 6 | **CONSERVAR** | Configuración de git vigente. | — |
| .instructions.md | 157 | **ARCHIVAR** | Plan de ejecución histórico de mejoras; sus tareas están ejecutadas o quedan obsoletas frente al GDD. | — |
| ADDICTION_LOOP_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Addiction Loop Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| AUDIO_ATMOSPHERE_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Audio Atmosphere Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| AUDITORIA_RESULTADO.md | 220 | **ARCHIVAR** | Reporte histórico de desarrollo (Auditoria Resultado); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| AUDIT_PHASES_1_TO_9.md | 325 | **ARCHIVAR** | Reporte histórico de desarrollo (Audit Phases 1 To 9); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| BROADCAST_CAMERA_REPORT.md | 35 | **ARCHIVAR** | Reporte histórico de desarrollo (Broadcast Camera Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| CAREER_MODE_READINESS_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Career Mode Readiness Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| CAREER_PSYCHOLOGY_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Career Psychology Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| CLUB_CULTURE_REPORT.md | 165 | **ARCHIVAR** | Reporte histórico de desarrollo (Club Culture Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| CLUB_IDENTITY_REPORT.md | 23 | **ARCHIVAR** | Reporte histórico de desarrollo (Club Identity Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| DEBUG_AUDIT_REPORT.md | 645 | **ARCHIVAR** | Reporte histórico de desarrollo (Debug Audit Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| DESPERATION_FOOTBALL_REPORT.md | 37 | **ARCHIVAR** | Reporte histórico de desarrollo (Desperation Football Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| DRESSING_ROOM_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Dressing Room Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| EMOTIONAL_DECISION_REPORT.md | 36 | **ARCHIVAR** | Reporte histórico de desarrollo (Emotional Decision Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| EMOTIONAL_MEMORY_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Emotional Memory Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| EMOTIONAL_MOMENTUM_REPORT.md | 30 | **ARCHIVAR** | Reporte histórico de desarrollo (Emotional Momentum Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| EXECUTION_SUMMARY.txt | 224 | **ARCHIVAR** | Reporte histórico de desarrollo (Execution Summary); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FANBASE_ENGINE_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Fanbase Engine Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FMG_CORE_MIGRATION.md | 198 | **CONSERVAR** | Documentación de arquitectura FMG.Core, vigente mientras exista el core. | Mover a /docs/ |
| FMG_CORE_QUICKREF.md | 293 | **CONSERVAR** | Referencia rápida de uso de FMG.Core, vigente. | Mover a /docs/ |
| FMG_CORE_VERIFICATION.md | 166 | **ARCHIVAR** | Checklist histórico de la migración FMG.Core, ya completada. | — |
| FOOTBALL_ATMOSPHERE_REPORT.md | 16 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Atmosphere Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FOOTBALL_CHAOS_REPORT.md | 44 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Chaos Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FOOTBALL_DRAMA_REPORT.md | 48 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Drama Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FOOTBALL_IMMERSION_REPORT.md | 14 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Immersion Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FOOTBALL_LIFE_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Life Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| FOOTBALL_MEMORY_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Football Memory Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| GAME_FEEL_AUDIT.md | 32 | **ARCHIVAR** | Reporte histórico de desarrollo (Game Feel Audit); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| HUMAN_FOOTBALL_AI_REPORT.md | 46 | **ARCHIVAR** | Reporte histórico de desarrollo (Human Football Ai Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| IMMERSION_CONSOLIDATION_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Immersion Consolidation Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| IMMERSION_FINALIZATION_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Immersion Finalization Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| IMMERSION_LANGUAGE_REPORT.md | 19 | **ARCHIVAR** | Reporte histórico de desarrollo (Immersion Language Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| IMMUTABLE_ARCHITECTURE_EXECUTION_SUMMARY.txt | 483 | **ARCHIVAR** | Reporte histórico de desarrollo (Immutable Architecture Execution Summary); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| IMMUTABLE_GAMESTATE_ARCHITECTURE.md | 361 | **CONSERVAR** | Documentación de la arquitectura de estado inmutable, vigente y alineada al GDD 9.2. | Mover a /docs/ |
| LEGACY_ENGINE_REPORT.md | 179 | **ARCHIVAR** | Reporte histórico de desarrollo (Legacy Engine Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| LEGACY_SYSTEM_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Legacy System Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| LEGENDARY_MOMENT_REPORT.md | 58 | **ARCHIVAR** | Reporte histórico de desarrollo (Legendary Moment Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| LOADING_ORDER.FMG_CORE.html | 45 | **ARCHIVAR** | Documenta el orden de carga de script tags; queda obsoleto al migrar a Vite. | — |
| LOCALIZATION_IMPROVEMENTS.md | 14 | **ARCHIVAR** | Reporte histórico de desarrollo (Localization Improvements); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| LONG_TERM_WORLD_SIMULATION_REPORT.md | 49 | **ARCHIVAR** | Reporte histórico de desarrollo (Long Term World Simulation Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_FEEL_2_REPORT.md | 49 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Feel 2 Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_FEEL_FINAL_REPORT.md | 20 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Feel Final Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_FEEL_POLISH_REPORT.md | 22 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Feel Polish Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_FEEL_REPORT.md | 19 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Feel Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_NARRATIVE_REPORT.md | 78 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Narrative Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_PRESENTATION_OVERHAUL_REPORT.md | 38 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Presentation Overhaul Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MATCH_STORYTELLING_REPORT.md | 53 | **ARCHIVAR** | Reporte histórico de desarrollo (Match Storytelling Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MEDIA_PRESSURE_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Media Pressure Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MEDIA_SYSTEM_REPORT.md | 141 | **ARCHIVAR** | Reporte histórico de desarrollo (Media System Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| MOVEMENT_HUMANIZATION_REPORT.md | 50 | **ARCHIVAR** | Reporte histórico de desarrollo (Movement Humanization Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| NEWS_VARIETY_REPORT.md | 28 | **ARCHIVAR** | Reporte histórico de desarrollo (News Variety Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PACKAGING_GUIDE.md | 80 | **CONSERVAR** | Guía operativa vigente de empaquetado PC/Android. | Mover a /docs/ |
| PANIC_SYSTEM_REPORT.md | 32 | **ARCHIVAR** | Reporte histórico de desarrollo (Panic System Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PERFORMANCE_VALIDATION_REPORT.md | 66 | **ARCHIVAR** | Reporte histórico de desarrollo (Performance Validation Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PERSISTENCE_ARCHITECTURE_REPORT.md | 39 | **ARCHIVAR** | Reporte histórico de desarrollo (Persistence Architecture Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PHASE_14_DOCUMENTATION.md | 431 | **ARCHIVAR** | Documentación técnica histórica del motor visual por fases (14-24). | — |
| PHASE_1_22_REVIEW.md | 37 | **ARCHIVAR** | Reporte histórico de desarrollo (Phase 1 22 Review); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PLAYER_CAREER_MODE_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Player Career Mode Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PLAYER_PERSONALITY_REPORT.md | 53 | **ARCHIVAR** | Reporte histórico de desarrollo (Player Personality Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PLAYER_REPUTATION_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Player Reputation Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PRE_PHASE10_MASTER_REPORT.md | 99 | **ARCHIVAR** | Reporte histórico de desarrollo (Pre Phase10 Master Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| PRE_PHASE10_READINESS_REPORT.md | 88 | **ARCHIVAR** | Reporte histórico de desarrollo (Pre Phase10 Readiness Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| README.md | 64 | **ADAPTAR** | Describe la visión antigua del proyecto (menciona Three.js que ya no se usa); reescribir para Football Life. | — |
| RELATIONSHIP_SYSTEM_REPORT.md | 67 | **ARCHIVAR** | Reporte histórico de desarrollo (Relationship System Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| REPORTE_AUDITORIA_PROBLEMAS_FMG_CHILE.md | 676 | **ARCHIVAR** | Reporte histórico de desarrollo (Reporte Auditoria Problemas Fmg Chile); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| RETIREMENT_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Retirement Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| RUNTIME_STRESS_HARNESS_REPORT.md | 63 | **ARCHIVAR** | Reporte histórico de desarrollo (Runtime Stress Harness Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| SCROLL_REDUCTION_REPORT.md | 20 | **ARCHIVAR** | Reporte histórico de desarrollo (Scroll Reduction Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| SOCIAL_DEPTH_REPORT.md | 27 | **ARCHIVAR** | Reporte histórico de desarrollo (Social Depth Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| TECHNICAL_DEBT_AND_PRODUCTION_READINESS_REPORT.md | 472 | **ARCHIVAR** | Reporte histórico de desarrollo (Technical Debt And Production Readiness Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| TECHNICAL_HARDENING_CONSOLIDATED_REPORT.md | 561 | **ARCHIVAR** | Reporte histórico de desarrollo (Technical Hardening Consolidated Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| TRANSFER_MARKET_REPORT.md | 152 | **ARCHIVAR** | Reporte histórico de desarrollo (Transfer Market Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| TRANSFER_PSYCHOLOGY_REPORT.md | 15 | **ARCHIVAR** | Reporte histórico de desarrollo (Transfer Psychology Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| UI_SIMPLIFICATION_REPORT.md | 19 | **ARCHIVAR** | Reporte histórico de desarrollo (Ui Simplification Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| UX_BEFORE_AFTER_REPORT.md | 18 | **ARCHIVAR** | Reporte histórico de desarrollo (Ux Before After Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| UX_DENSITY_REPORT.md | 32 | **ARCHIVAR** | Reporte histórico de desarrollo (Ux Density Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| VISUALIZER_COMPLETION_REPORT.md | 67 | **ARCHIVAR** | Reporte histórico de desarrollo (Visualizer Completion Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| VISUAL_HIERARCHY_REPORT.md | 25 | **ARCHIVAR** | Reporte histórico de desarrollo (Visual Hierarchy Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| WEAKNESS_FIXES_REPORT.md | 41 | **ARCHIVAR** | Reporte histórico de desarrollo (Weakness Fixes Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| WORLD_EVOLUTION_REPORT.md | 162 | **ARCHIVAR** | Reporte histórico de desarrollo (World Evolution Report); sin valor operativo para el GDD. | Mover completo a /docs/legacy/ |
| assets/favicon.svg | 9 | **CONSERVAR** | Ícono de la aplicación. | — |
| assets/icons.svg | 14 | **CONSERVAR** | Set de íconos SVG de la interfaz. | — |
| assets/og-preview.svg | 20 | **CONSERVAR** | Imagen de vista previa para compartir en redes. | — |
| assets/vendor/three.r128.min.js | 6 | **ELIMINAR** | Librería Three.js (600 KB) sin un solo uso: cero referencias a THREE en src/ y ui/. | index.html:34 la carga; quitar esa línea (ver sec. 3) |
| capacitor.config.json | 29 | **CONSERVAR** | Config de empaquetado Android con Capacitor (GDD 9.1). | — |
| css/styles.css | 1865 | **CONSERVAR** | Hoja de estilos completa del SPA (1.865 líneas). | — |
| data/players.json | 5150 | **CONSERVAR** | Base de datos de jugadores del torneo chileno. | Nombres ficticios verosímiles; revisar en ficcionalización Fase 9 |
| data/teams.json | 242 | **CONSERVAR** | Base de datos de clubes chilenos con presupuestos y estadios. | Nombres de clubes REALES: ficcionalizar antes de publicar (GDD 11.1) |
| dev-server.js | 53 | **ADAPTAR** | Servidor de desarrollo casero; será reemplazado por el dev server de Vite en Fase 0 (GDD 10.2). | — |
| electron/main.js | 65 | **CONSERVAR** | Empaquetado de escritorio Electron ya configurado (GDD 9.1). | Apuntar al build de Vite tras Fase 0 |
| eslint.config.js | 35 | **CONSERVAR** | Config ESLint activa (flat config, ESLint 9); GDD 9.3 conserva la configuración. | — |
| index.html | 198 | **ADAPTAR** | Carga 153 script tags globales; migrar a un único entry point con Vite (GDD 9.3). | Carga three.js muerto en línea 34 (ver sec. 3) |
| manifest.json | 34 | **CONSERVAR** | Manifiesto PWA para instalación en Android/desktop. | — |
| package-lock.json | 1106 | **CONSERVAR** | Lockfile npm que fija versiones de eslint/typescript. | — |
| package.json | 45 | **CONSERVAR** | Manifiesto npm con scripts vigentes; GDD 9.3 conservar. | Los scripts dev/test cambiarán al migrar a Vite |
| src/FMG.Core/Adapters/LegacyGameStateAdapter.js | 225 | **ADAPTAR** | Puente temporal entre el estado legacy y FMG.Core; desaparece al completar la migración a /core. | — |
| src/FMG.Core/Diagnostics/RuntimeDiagnostics.js | 693 | **CONSERVAR** | Diagnóstico de runtime del core (invariantes, salud del estado). | — |
| src/FMG.Core/Domain/Aggregates.js | 62 | **CONSERVAR** | Registro central de agregados del dominio. | — |
| src/FMG.Core/Domain/Club/ClubAggregate.js | 128 | **CONSERVAR** | Modelo de dominio inmutable de Club; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Club/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Club para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Domain/Manager/ManagerAggregate.js | 65 | **CONSERVAR** | Modelo de dominio inmutable de Manager; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Manager/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Manager para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Domain/Market/MarketAggregate.js | 64 | **CONSERVAR** | Modelo de dominio inmutable de Market; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Market/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Market para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Domain/Match/MatchRecord.js | 94 | **CONSERVAR** | Modelo de dominio inmutable de Match; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Match/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Match para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Domain/Player/PlayerEntity.js | 68 | **CONSERVAR** | Modelo de dominio inmutable de Player; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Player/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Player para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Domain/Season/SeasonAggregate.js | 98 | **CONSERVAR** | Modelo de dominio inmutable de Season; alineado a /core del GDD 9.2. | — |
| src/FMG.Core/Domain/Season/index.js | 11 | **CONSERVAR** | Barrel de exportación del dominio Season para ES modules. | No lo carga index.html; cobra sentido con Vite |
| src/FMG.Core/Engine/GameState.js | 304 | **CONSERVAR** | Motor de estado inmutable del core (GameState); GDD 9.2 /core. | — |
| src/FMG.Core/Engine/Reducers.js | 318 | **CONSERVAR** | Motor de estado inmutable del core (Reducers); GDD 9.2 /core. | — |
| src/FMG.Core/Engine/SimulationEngine.js | 405 | **CONSERVAR** | Motor de estado inmutable del core (SimulationEngine); GDD 9.2 /core. | — |
| src/FMG.Core/Engine/StateBuilder.js | 55 | **CONSERVAR** | Motor de estado inmutable del core (StateBuilder); GDD 9.2 /core. | — |
| src/FMG.Core/Engine/StateSnapshot.js | 290 | **CONSERVAR** | Motor de estado inmutable del core (StateSnapshot); GDD 9.2 /core. | — |
| src/FMG.Core/Engine/StateTransition.js | 251 | **CONSERVAR** | Motor de estado inmutable del core (StateTransition); GDD 9.2 /core. | — |
| src/FMG.Core/Events/EventBus.js | 160 | **CONSERVAR** | Bus de eventos del core. | Absorber los buses duplicados de src/architecture.js |
| src/FMG.Core/Repository/ClubRepository.js | 98 | **CONSERVAR** | Repositorio de persistencia del core (ClubRepository). | Backend de guardado migrará a IndexedDB (GDD 9.1) |
| src/FMG.Core/Repository/GameStateRepository.js | 234 | **CONSERVAR** | Repositorio de persistencia del core (GameStateRepository). | Backend de guardado migrará a IndexedDB (GDD 9.1) |
| src/FMG.Core/Repository/SeasonRepository.js | 73 | **CONSERVAR** | Repositorio de persistencia del core (SeasonRepository). | Backend de guardado migrará a IndexedDB (GDD 9.1) |
| src/FMG.Core/Services/MatchSimulator.js | 183 | **CONSERVAR** | Simulador de partido del core. | Duplica rol con src/matchEngine.js; consolidar (ver esa fila) |
| src/FMG.Core/Utils/RNG.js | 145 | **CONSERVAR** | RNG determinista; el GDD 9.2 lo exige en /core. | — |
| src/FMG.Core/index.js | 143 | **CONSERVAR** | Punto de entrada y ensamblaje de FMG.Core. | — |
| src/MatchPlaybackEngine.js | 504 | **ADAPTAR** | Motor de reproducción tick-a-tick usado solo por matchVisualController; consolidar en el motor 2D único (GDD sec. 8). | 2 de 3 exports sin uso externo |
| src/advancedTransferMarket.js | 1057 | **CONSERVAR** | Mercado de fichajes avanzado con drama; GDD 9.3 lo lista explícitamente como conservar. | — |
| src/advancedYouthAcademy.js | 437 | **CONSERVAR** | Cantera y juveniles; GDD 9.3 conservar. | — |
| src/architecture.js | 259 | **ADAPTAR** | Buses de eventos/comandos que duplican FMG.Core/Events/EventBus.js; consolidar en /core. | 7 de 14 exports sin uso externo |
| src/career.js | 548 | **CONSERVAR** | Estilos y reputación del DT; base del modo DT del GDD sec. 7. | — |
| src/clubCulture.js | 581 | **CONSERVAR** | Cultura e identidad de club; alimenta vestuario y fanaticada (GDD sec. 7). | — |
| src/ecs.js | 186 | **CONSERVAR** | ECS básico; el GDD 9.2 contempla ECS dentro de /core. | Hoy solo lo usan los tests; revisar con humano |
| src/events.js | 110 | **ADAPTAR** | Motor de eventos semanales; GDD 9.3 pide ampliarlo como base del life-sim. | — |
| src/finances.js | 273 | **CONSERVAR** | Finanzas del CLUB (modo DT); las finanzas personales del jugador (GDD 5.2) serán módulo nuevo en /life. | — |
| src/footballUniverse.js | 450 | **ADAPTAR** | Genera el universo de ligas; expandir al modelo de ligas profundas/superficiales multi-país (GDD 6.1). | — |
| src/gameEngine.js | 1173 | **CONSERVAR** | Motor de simulación semanal principal; GDD 9.3 conservar. | — |
| src/gameState.js | 91 | **CONSERVAR** | Estado global y rutas del juego; GDD 9.3 conservar. | Limpiar rutas phase15-24 al renombrar vistas |
| src/humanFootballAI.js | 443 | **CONSERVAR** | IA humana en cancha (pánico, confianza, fatiga mental); soporta la personalidad en partido (GDD 4.3). | — |
| src/immersion.js | 423 | **ADAPTAR** | Capa narrativa de inmersión; GDD 9.3 pide ampliarla con cinemáticas. | — |
| src/immersionIntegration.js | 237 | **ADAPTAR** | Integra la narrativa con simulación y partidos; ampliar junto a immersion.js (GDD 9.3). | — |
| src/legacyEngine.js | 418 | **ADAPTAR** | Hall of Fame e historia de clubes; es la base natural del universo compartido persistente (GDD 5.4). | — |
| src/liveChallenges.js | 194 | **CONSERVAR** | Desafíos en vivo durante el partido; base del 'ver + intervenir' (GDD 2.4). | — |
| src/main.js | 739 | **ADAPTAR** | Bootstrap del SPA con carga global; migrar a ES modules con Vite (GDD 9.3). | Contiene el router y la integración del visualizador |
| src/managerEcosystem.js | 760 | **CONSERVAR** | Ecosistema de DTs rivales con personalidad; sirve al modo DT (GDD sec. 7). | — |
| src/matchEngine.js | 535 | **ADAPTAR** | Simulador estadístico de partido activo (FMG.simulateMatch); consolidar con FMG.Core/Services/MatchSimulator.js, que duplica el rol. | — |
| src/matchNarrative.js | 538 | **CONSERVAR** | Narrativa y relato del partido; alimenta los comentarios del motor 2D (GDD 10.10). | — |
| src/matchVisualController.js | 424 | **ADAPTAR** | Sincroniza matchVisualizer con el SPA; fusionar en el motor de partido único. | — |
| src/matchVisualizer.js | 1976 | **CONSERVAR** | Base del motor visual 2D (~2.000 líneas); GDD 9.3 conservar, con refactor posterior. | — |
| src/news.js | 562 | **ADAPTAR** | Prensa deportiva; expandir a prensa+farándula (GDD 5.2). | Rivalidades con nombres reales: ficcionalizar (GDD 11.1) |
| src/performance.js | 204 | **CONSERVAR** | Reloj determinista y presupuesto de rendimiento; infraestructura de /core. | — |
| src/phase15/game.js | 305 | **ARCHIVAR** | Prototipo v1 del motor 2D jugable, superado por la cadena phase16-24. | Aún referenciado (ver sec. 3) |
| src/phase15/renderer.js | 180 | **ARCHIVAR** | Renderer del prototipo v1, superado por phase17/21. | Aún referenciado (ver sec. 3) |
| src/phase16/AISystem.js | 56 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/AnimationSystem.js | 32 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/AudioSystem.js | 21 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | Stub silencioso; implementar audio real |
| src/phase16/BallSystem.js | 122 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/CameraSystem.js | 49 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/HUDSystem.js | 208 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | Tiene TODO pendiente señalado en .instructions.md |
| src/phase16/InputSystem.js | 63 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/MatchSystem.js | 149 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/constants.js | 52 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase16/index.js | 239 | **ADAPTAR** | Parte del motor 2D jugable (framework modular de sistemas del motor 2D); mover a /simulation con nombre semántico (GDD 9.2). | — |
| src/phase17/AnimationClip.js | 244 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/BallRenderer.js | 117 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/BlendTree.js | 77 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/EffectsSystem.js | 238 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/PlayerRenderer.js | 78 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/PlayerState.js | 116 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase17/index.js | 209 | **ADAPTAR** | Parte del motor 2D jugable (animaciones procedurales de jugadores); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase16Game |
| src/phase18/DecisionSystem.js | 251 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase18/Formation.js | 164 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase18/MovementSystem.js | 103 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase18/PlayerRole.js | 122 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase18/TeamBrain.js | 207 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase18/index.js | 135 | **ADAPTAR** | Parte del motor 2D jugable (IA de decisión y comportamiento de equipos); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase17 |
| src/phase19/GoalkeeperAnimClip.js | 137 | **ADAPTAR** | Parte del motor 2D jugable (porteros (IA y animación)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase18 |
| src/phase19/GoalkeeperBrain.js | 192 | **ADAPTAR** | Parte del motor 2D jugable (porteros (IA y animación)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase18 |
| src/phase19/SaveSystem.js | 118 | **ADAPTAR** | Parte del motor 2D jugable (porteros (IA y animación)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase18 |
| src/phase19/index.js | 181 | **ADAPTAR** | Parte del motor 2D jugable (porteros (IA y animación)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase18 |
| src/phase20/BroadcastHUD.js | 235 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase20/CameraController.js | 143 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase20/CameraState.js | 77 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase20/ReplayBuffer.js | 86 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase20/ReplayPlayer.js | 72 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase20/index.js | 196 | **ADAPTAR** | Parte del motor 2D jugable (cámara broadcast, replays y HUD televisivo); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase19 |
| src/phase21/AdvertRenderer.js | 80 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase21/CrowdRenderer.js | 157 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase21/GoalRenderer.js | 150 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase21/PitchRenderer.js | 162 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase21/StadiumRenderer.js | 171 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase21/index.js | 107 | **ADAPTAR** | Parte del motor 2D jugable (renderizado del estadio (cancha, gradas, público)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase20 |
| src/phase22/FinalHUD.js | 129 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/HUDData.js | 190 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/LowerThird.js | 93 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/MatchStatsPanel.js | 131 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/PlayerPanel.js | 115 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/PowerMeter.js | 89 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/RadarMinimap.js | 116 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase22/index.js | 334 | **ADAPTAR** | Parte del motor 2D jugable (HUD final del partido (paneles, radar, potencia)); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase21 |
| src/phase23/StadiumAudio.js | 262 | **ADAPTAR** | Parte del motor 2D jugable (audio de estadio); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase22 |
| src/phase23/index.js | 84 | **ADAPTAR** | Parte del motor 2D jugable (audio de estadio); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase22 |
| src/phase24/AttributeModifier.js | 204 | **ADAPTAR** | Parte del motor 2D jugable (tácticas aplicadas en cancha); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase23; tope de la cadena |
| src/phase24/TacticsApplier.js | 202 | **ADAPTAR** | Parte del motor 2D jugable (tácticas aplicadas en cancha); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase23; tope de la cadena |
| src/phase24/TeamBrainWithTactics.js | 112 | **ADAPTAR** | Parte del motor 2D jugable (tácticas aplicadas en cancha); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase23; tope de la cadena |
| src/phase24/index.js | 126 | **ADAPTAR** | Parte del motor 2D jugable (tácticas aplicadas en cancha); mover a /simulation con nombre semántico (GDD 9.2). | Extiende Phase23; tope de la cadena |
| src/playerAttributes.js | 208 | **CONSERVAR** | Sistema de atributos del jugador; GDD 9.3 conservar. | — |
| src/playerCareer.js | 661 | **CONSERVAR** | Carrera del jugador (fase 10); GDD 9.3 conservar. | — |
| src/playerMode.js | 284 | **ADAPTAR** | Modo Jugador embrionario; es el corazón del GDD (vida futbolística) y necesita expansión mayor en Fase 1. | — |
| src/playerProgression.js | 314 | **CONSERVAR** | Progresión de atributos y personalidad; GDD 9.3 conservar. | — |
| src/playerProgressionIntegration.js | 233 | **CONSERVAR** | Conecta la progresión al scheduler semanal; acompaña a playerProgression.js. | — |
| src/presentation.js | 61 | **CONSERVAR** | Identidades visuales de clubes (colores, iniciales). | Colores/nombres de clubes reales: ficcionalizar en Fase 9 (GDD 11.1) |
| src/presentationAtmosphere.js | 288 | **CONSERVAR** | Atmósfera de presentación de partidos (público, contexto). | — |
| src/rivalries.js | 275 | **CONSERVAR** | Rivalidades dinámicas con tensión acumulada; alimenta el drama deportivo del GDD. | — |
| src/runtimeHardening.js | 2839 | **ADAPTAR** | Robustez de runtime de 2.839 líneas que mezcla dominios; dividir según la estructura del GDD 9.2. | 42 de 94 exports sin uso externo: candidatos a poda |
| src/saveSystem.js | 281 | **ADAPTAR** | Guardado en localStorage; GDD 9.1 pide migrar a IndexedDB con export JSON. | — |
| src/seasonDrama.js | 191 | **ADAPTAR** | Momentos de drama de temporada; GDD 9.3 pide ampliarlo para el life-sim. | — |
| src/simulationScheduler.js | 117 | **CONSERVAR** | Scheduler de trabajos semanales de simulación. | 1 de 3 exports con uso externo; revisar |
| src/squad.js | 611 | **CONSERVAR** | Plantel, formaciones y alineación; núcleo táctico del modo DT. | — |
| src/squadPsychology.js | 1004 | **CONSERVAR** | Psicología del plantel y personalidad de jugadores; GDD 9.3 conservar. | — |
| src/table.js | 56 | **CONSERVAR** | Tabla de posiciones y estadísticas de liga. | — |
| src/tacticalIntelligence.js | 227 | **CONSERVAR** | Inteligencia táctica del partido (pressing, calidad de tiro). | — |
| src/transfers.js | 612 | **CONSERVAR** | Mercado de fichajes base; GDD 9.3 conservar. | — |
| src/uiAudio.js | 108 | **CONSERVAR** | Audio de interfaz vía WebAudio, sin assets externos. | — |
| src/uiFeedback.js | 108 | **CONSERVAR** | Toasts y avisos de interfaz. | — |
| src/utils.js | 269 | **CONSERVAR** | Utilidades núcleo (clamp, hash, IDs deterministas, claves de guardado); lo usa todo el código. | — |
| src/worldEvolution.js | 544 | **CONSERVAR** | Evolución del mundo futbolístico a largo plazo; alineado a la simulación de mundo del GDD. | — |
| src/worldMediaPressure.js | 893 | **CONSERVAR** | Prensa mundial y presión mediática; GDD 9.3 conservar. | — |
| sw.js | 61 | **ADAPTAR** | Service worker PWA funcional; la lista de assets cacheados debe regenerarse con el build de Vite. | — |
| tests/advancedTransferMarket.test.js | 110 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/advancedYouthAcademy.test.js | 86 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/deterministicRuntime.test.js | 159 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/gameStateRepository.test.js | 210 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/hardening.test.js | 168 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/immersion.test.js | 304 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/immutable_state.test.js | 360 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/longTermWorldSimulation.test.js | 124 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/managerEcosystem.test.js | 84 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/performance_foundation.test.js | 102 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/persistenceArchitecture.test.js | 224 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase0.test.js | 86 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase1.test.js | 89 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase10.test.js | 119 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase11.test.js | 118 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase12.test.js | 90 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase13.test.js | 119 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase15_16_17_smoke.test.js | 128 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | Referencia src/phase15 (ver sec. 3) |
| tests/phase19_22.test.js | 212 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase2.test.js | 86 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase24.test.js | 218 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase2_architecture.test.js | 99 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase3.test.js | 95 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase4.test.js | 146 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase5.test.js | 134 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase6.test.js | 139 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase7.test.js | 98 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase8.test.js | 81 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/phase9.test.js | 112 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/playerCareer.test.js | 263 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/playerMode.test.js | 95 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/playerProgression.test.js | 268 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/pre_phase10_finalization.test.js | 232 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/pre_phase10_validation.test.js | 226 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/run-all.js | 59 | **CONSERVAR** | Runner de la suite de tests (35/35 pasando). | — |
| tests/runtimeStressHarness.test.js | 153 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/squadPsychology.test.js | 99 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/stabilization.test.js | 104 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tests/worldMediaPressure.test.js | 91 | **CONSERVAR** | Test de regresión de la suite; GDD 9.3: 'la disciplina de tests es oro'. | — |
| tsconfig.json | 22 | **CONSERVAR** | TypeScript progresivo ya configurado (GDD 9.1). | — |
| types/football-architecture.ts | 99 | **CONSERVAR** | Tipos TypeScript del dominio; base de la migración TS progresiva (GDD 9.1). | — |
| ui/calendarView.js | 50 | **CONSERVAR** | Vista de calendario y fixture; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/careerView.js | 361 | **CONSERVAR** | Vista de carrera del DT; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/creditsView.js | 19 | **CONSERVAR** | Vista de créditos; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/dashboard.js | 243 | **CONSERVAR** | Panel principal del club con tendencias; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/financeView.js | 101 | **CONSERVAR** | Vista de finanzas del club; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/hallOfFameView.js | 65 | **CONSERVAR** | Vista del Hall of Fame; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/historyView.js | 69 | **CONSERVAR** | Vista de historia y momentos legendarios; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/legacyView.js | 70 | **CONSERVAR** | Vista de legado del DT; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/marketView.js | 214 | **CONSERVAR** | Vista del mercado de fichajes; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/matchView.js | 442 | **CONSERVAR** | Vista de partido del SPA; aloja el visualizador 2D; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/newsView.js | 152 | **CONSERVAR** | Vista de noticias y prensa; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/onboardingView.js | 53 | **CONSERVAR** | Pantalla de inicio/creación de partida; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/phase15View.js | 131 | **ARCHIVAR** | Vista sandbox del prototipo phase15, superada. | Aún referenciada por main.js e index.html (ver sec. 3) |
| ui/phase16View.js | 67 | **ADAPTAR** | Vista sandbox 'Jugar v2' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase17View.js | 63 | **ADAPTAR** | Vista sandbox 'Jugar v3' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase18View.js | 63 | **ADAPTAR** | Vista sandbox 'Jugar v4' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase19View.js | 61 | **ADAPTAR** | Vista sandbox 'Jugar v5' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase20View.js | 61 | **ADAPTAR** | Vista sandbox 'Jugar v6' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase21View.js | 64 | **ADAPTAR** | Vista sandbox 'Jugar v7' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase22View.js | 64 | **ADAPTAR** | Vista sandbox 'Jugar v8' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase23View.js | 69 | **ADAPTAR** | Vista sandbox 'Jugar v9' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/phase24View.js | 118 | **ADAPTAR** | Vista sandbox 'Jugar v10' (solo visible en modo dev); renombrar a vista semántica o fusionar en matchView (GDD 9.3). | — |
| ui/playerCareerView.js | 216 | **CONSERVAR** | Vista de carrera del jugador (modo Jugador); sirve a la interfaz vigente y a la nueva visión. | — |
| ui/playerView.js | 97 | **CONSERVAR** | Ficha del jugador con atributos; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/rivalView.js | 83 | **CONSERVAR** | Vista de clubes rivales; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/settingsView.js | 87 | **CONSERVAR** | Vista de ajustes; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/tableView.js | 108 | **CONSERVAR** | Vista de tabla de posiciones; sirve a la interfaz vigente y a la nueva visión. | — |
| ui/teamView.js | 303 | **CONSERVAR** | Vista de plantel y tácticas; sirve a la interfaz vigente y a la nueva visión. | — |

## 3. Dependencias rotas detectadas

Archivos marcados ELIMINAR/ARCHIVAR que **todavía** están referenciados por código vivo. Fase 0 debe cortar estas referencias al moverlos:

- `assets/vendor/three.r128.min.js` (ELIMINAR) `<-` **index.html:34** (tag `<script>`; borrar esa línea al eliminar).
- `src/phase15/game.js` + `src/phase15/renderer.js` (ARCHIVAR) `<-` **index.html** (script tags), **src/gameState.js** (ruta `phase15`), **src/main.js:131,257** (menú dev 'Jugar v1' y render), **ui/phase15View.js**, **tests/phase15_16_17_smoke.test.js** (vía run-all.js).
- `ui/phase15View.js` (ARCHIVAR) `<-` **index.html** (script tag), **src/main.js:257** (`FMG.renderPhase15View()`).
- `.eslintrc.json` (ELIMINAR): **ninguna referencia** — ESLint 9 usa `eslint.config.js` y la ignora; borrado seguro.
- Los ~75 reportes `.md`/`.txt` de raíz (ARCHIVAR): **ninguna referencia desde código**; mover a `/docs/legacy/` no rompe nada.

## 4. Recomendaciones para Fase 0 (solo lista, no ejecutar)

1. Crear `/docs/legacy/` y mover los ~75 reportes históricos de la raíz (más `AUDIT_REPORTS/` completo, ya acordado). Mover los 4 docs vigentes (`PACKAGING_GUIDE`, `FMG_CORE_MIGRATION`, `FMG_CORE_QUICKREF`, `IMMUTABLE_GAMESTATE_ARCHITECTURE`) a `/docs/`.
2. Eliminar `assets/vendor/three.r128.min.js` y su tag en `index.html:34`, y eliminar `.eslintrc.json`. Correr tests (deben seguir 35/35).
3. **Decidir el motor de partido canónico** (pregunta abierta #1) ANTES de migrar a Vite, para no cargar módulos que van a morir.
4. Migrar de 153 script tags a Vite con ES modules; los barrels de `FMG.Core/Domain/*/index.js` ya están listos para import/export.
5. Renombrar `ui/phase16View.js → ui/phase24View.js` y `src/phase16-24/` a nombres semánticos bajo `/simulation` y `/ui` (GDD 9.2); archivar `src/phase15/` + `ui/phase15View.js` cortando las referencias de la sec. 3 y actualizando el smoke test.
6. Consolidar duplicados: `matchEngine.js` vs `FMG.Core/Services/MatchSimulator.js`, y `architecture.js` (buses) vs `FMG.Core/Events/EventBus.js`.
7. Preparar el esqueleto del universo compartido en IndexedDB (GDD 10.2) y las carpetas nuevas `/life`, `/character`, `/persistence`, `/data/countries`.
8. Actualizar `sw.js` (lista de cache) y `README.md` a la nueva realidad post-Vite.
9. Criterio de cierre de Fase 0 (GDD 10.2): el proyecto compila con Vite y los tests siguen 35/35.

## 5. Preguntas abiertas

1. **¿Cuál motor de partido 2D es el canónico?** `matchVisualizer.js` (viejo, integrado al flujo real del juego) vs la cadena `phase16→24` (moderna: sistemas, porteros, cámara broadcast, estadio, HUD, tácticas — exactamente lo que pide el GDD sec. 8 — pero vive como sandbox dev). Recomendación tentativa: promover la cadena phase16-24 a motor oficial y degradar matchVisualizer a referencia, pero el GDD 9.3 dice conservar matchVisualizer — necesita decisión humana.
2. **¿`src/phase15/` se archiva o se elimina?** Es prototipo superado, pero un test lo cubre; lo marqué ARCHIVAR (opción conservadora).
3. **¿`src/ecs.js` tiene futuro?** Solo los tests lo usan hoy, pero el GDD 9.2 menciona ECS en /core. Lo marqué CONSERVAR; confirmar si el nuevo motor lo usará de verdad.
4. **¿Cuándo se ficcionalizan los nombres reales?** El GDD lo pone en Fase 9, pero `data/teams.json`, `presentation.js` y `news.js` ya los traen; si el juego se comparte públicamente antes (itch.io beta), habría que adelantarlo.
5. **`runtimeHardening.js` (2.839 líneas, 42 exports sin uso externo)**: ¿se poda en Fase 0 o se difiere? Podarlo temprano simplifica la migración a Vite, pero es riesgo extra en la misma fase.
6. Los tests `phaseN.test.js` conservan nombres por fase histórica; ¿se renombran junto a los módulos en Fase 0 o se dejan como están hasta el vertical slice?
