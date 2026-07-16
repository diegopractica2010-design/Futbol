# ════════════════════════════════════════════════════════════
# REPORTE DE AUDITORÍA — FOOTBALL MANAGER CHILE v0.1.0
# Fecha de análisis: 2026-05-16
# ════════════════════════════════════════════════════════════

## RESUMEN EJECUTIVO

Total de problemas detectados: 77

- 🔴 Críticos: 7
- 🟠 Mayores: 30
- 🟡 Menores: 25
- 🔵 Observaciones: 15

Área con mayor número de problemas: CAPA 1, CAPA 2  
Área con problemas más críticos: CAPA 2 — Motor de simulación y FMG.Core  
Sistema con más riesgo inmediato: puente FMG.Core ↔ legacy y persistencia de largo plazo

Validación ejecutada:

- `npm test`: PASS completo.
- Auditoría previa de navegador real: Chrome headless con onboarding, selección de club, navegación rápida, avance semanal Core y save/load sin excepción.
- Stress previo registrado: 10 temporadas, 25 temporadas, 50 temporadas forzadas, base grande, replay/snapshot, live match y lifecycle de listeners.

Este reporte contiene solo detección de problemas. No incluye correcciones ni recomendaciones.

---

# ════════════════════════════════════════════════════════════
# CAPA 1 — SYSTEMS & GAME DESIGN
# ════════════════════════════════════════════════════════════

## [DS-001] 🔴 CRÍTICO
Archivo: `src/gameEngine.js` (líneas aprox. 794-830)  
Sistema: Loop de carrera / transición de temporada  
Descripción: El flujo normal de simulación larga puede quedar bloqueado por `career.status === "sacked"` al intentar iniciar nueva temporada. En stress normal de 50 temporadas el flujo se detuvo en temporada 3 con `Acepta una oferta antes de iniciar otra temporada.`  
Impacto: La simulación de universo a largo plazo no puede continuar sin intervención del usuario o sin una oferta válida.  
Contexto específico del proyecto: Afecta carreras con Colo-Colo, Wanderers o cualquier club si la evaluación de directorio despide al manager antes de iniciar la siguiente temporada.

## [DS-002] 🟠 MAYOR
Archivo: `src/gameEngine.js` (líneas aprox. 798-809)  
Sistema: Reset de temporada  
Descripción: `startNewSeason()` reinicia fixture, standings, logs y estado competitivo, pero conserva arrays globales de jugadores retirados y múltiples memorias de subsistemas.  
Impacto: La carrera acumula entidades históricas dentro del estado activo, elevando costo de filtros, saves y simulación.  
Contexto específico del proyecto: En stress forzado de 50 temporadas se observaron 959 jugadores, 675 de ellos retirados retenidos en `state.players`.

## [DS-003] 🟠 MAYOR
Archivo: `src/gameEngine.js` (líneas aprox. 104-138, 145-181)  
Sistema: Copas / competición internacional  
Descripción: Copa Chile e internacional se resuelven como torneos knockout generados al cierre de temporada, no como calendarios persistentes semana a semana.  
Impacto: No existe flujo jugable completo de copa, fixture visible por fecha, ni dead-end detectable hasta el final.  
Contexto específico del proyecto: `completeSeasonCompetitions()` crea campeones de copa sin que el usuario gestione esos partidos durante la temporada.

## [DS-004] 🟠 MAYOR
Archivo: `src/gameEngine.js` (líneas aprox. 67-87)  
Sistema: Calendario round-robin  
Descripción: `createRoundRobin()` agrega `null` cuando hay número impar, pero con 13 equipos expandidos a 13 genera una fecha libre por ronda. La UI no comunica claramente semanas de descanso antes de intentar iniciar un live match.  
Impacto: El jugador puede recibir `Tu club descansa esta semana` sin anticipación contextual fuerte.  
Contexto específico del proyecto: En prueba live match con Colo-Colo, semana 1 fue descanso y el partido en vivo solo pudo iniciarse tras avanzar una semana.

## [DS-005] 🟠 MAYOR
Archivo: `src/finances.js` (líneas aprox. 78, 228-230)  
Sistema: Economía / insolvencia  
Descripción: El balance se limita por clamp a `-999999999`, y la crisis por caja negativa solo marca `finances.crisis`; no hay estado terminal de bancarrota.  
Impacto: Un club puede permanecer indefinidamente con caja negativa sin un cierre sistémico claro.  
Contexto específico del proyecto: Equipos con gastos altos y préstamos pueden quedar bajo `-35.000.000` CLP con crisis activa pero carrera operativa.

## [DS-006] 🟡 MENOR
Archivo: `src/finances.js` (líneas aprox. 49-65)  
Sistema: Sponsor / TV deal  
Descripción: `sponsorDeal` y `tvDeal` se crean si no existen, pero no se observa renegociación obligatoria por temporada ni expiración equivalente para TV.  
Impacto: La economía puede arrastrar contratos fijos no representativos del rendimiento o ascenso competitivo.  
Contexto específico del proyecto: Colo-Colo conserva deal derivado de presupuesto/fanBase inicial salvo flujos específicos de negociación.

## [DS-007] 🟡 MENOR
Archivo: `src/main.js` (líneas aprox. 17-21)  
Sistema: Dificultad percibida  
Descripción: `clubDifficulty()` clasifica dificultad solo por `budget / 145000000`, haciendo que el club más rico aparezca como “Difícil”.  
Impacto: La etiqueta puede contradecir la expectativa de accesibilidad por recursos deportivos.  
Contexto específico del proyecto: Colo-Colo aparece como difícil por presupuesto máximo, aunque también tiene mayor capacidad económica.

## [DS-008] 🔵 OBSERVACIÓN
Archivo: `src/career.js` (líneas aprox. 12-20)  
Sistema: Logros de carrera  
Descripción: `achievementDefinitions` contiene solo 7 logros y no cubre múltiples trayectorias: evitar descenso, ganar supercopa, desarrollo de cantera avanzada, estabilidad financiera multianual o rivalidades.  
Impacto: La carrera larga pierde reconocimiento sistémico de hitos relevantes.  
Contexto específico del proyecto: Temporadas sin Copa Chile jugable pueden dejar logros de copa irrelevantes o inaccesibles.

---

# ════════════════════════════════════════════════════════════
# CAPA 2 — MOTOR DE SIMULACIÓN Y MATCH ENGINE
# ════════════════════════════════════════════════════════════

## [ME-001] 🔴 CRÍTICO
Archivo: `src/FMG.Core/Engine/SimulationEngine.js` (contexto `_autoSelectLineup`)  
Sistema: FMG.Core / selección automática de plantel  
Descripción: El Core filtra por `suspensionWeeks === 0`, mientras el estado legacy usa `suspendedWeeks`. Los jugadores legacy no cumplen el filtro y el Core puede reemplazar squads por arrays vacíos.  
Impacto: Después de un `advanceWeek()` ruteado por Core, `FMG.gameState.players` puede quedar vacío.  
Contexto específico del proyecto: Reproducido con Colo-Colo tras inicializar FMG.Core y avanzar una semana.

## [ME-002] 🔴 CRÍTICO
Archivo: `src/FMG.Core/Adapters/LegacyGameStateAdapter.js` (líneas aprox. 115-126)  
Sistema: Adaptador FMG.Core → legacy  
Descripción: `fromCore()` reconstruye equipos con un subconjunto de campos y descarta `city`, `style`, `sponsor`, `infrastructureCost` y otros datos legacy.  
Impacto: Pérdida de datos de club y degradación de saves tras semanas Core.  
Contexto específico del proyecto: Colo-Colo pierde campos que se usan en dashboard, finanzas, identidad y dificultad.

## [ME-003] 🟠 MAYOR
Archivo: `src/FMG.Core/Engine/GameState.js` (líneas aprox. 126-135)  
Sistema: Checksum / replay  
Descripción: `_calculateChecksum()` solo incluye versión, semana, temporada, cantidad de clubes y nombre del manager. No incluye jugadores, tabla, finanzas, fixtures, tácticas ni metadata.  
Impacto: Corrupciones profundas pueden pasar como replay válido.  
Contexto específico del proyecto: El borrado de jugadores por Core puede no ser detectado por checksum si semana y cantidad de clubes coinciden.

## [ME-004] 🟠 MAYOR
Archivo: `src/FMG.Core/Engine/SimulationEngine.js` (líneas aprox. 241-258)  
Sistema: Validación replay semanal  
Descripción: La validación post-semana carga el snapshot final más reciente y reproduce cero acciones; valida restauración de snapshot, no la secuencia de transiciones que generó el estado.  
Impacto: Falsa confianza en determinismo de `UPDATE_CLUBS`, `UPDATE_SEASON`, `APPLY_WEEKLY_EFFECTS` y `ADVANCE_WEEK`.  
Contexto específico del proyecto: Browser probe mostró `replay: true` en Core weeks, pero no estaba reejecutando la semana completa.

## [ME-005] 🟠 MAYOR
Archivo: `src/matchEngine.js` (líneas aprox. 35-40)  
Sistema: Rating de plantel  
Descripción: `ratingFromSquad()` devuelve 0 cuando no hay jugadores porque `FMG.average([])` retorna 0, sin marcar estado inválido de plantilla.  
Impacto: Equipos sin 11 jugadores simulan con rating 0 en vez de fallar o exponer problema competitivo.  
Contexto específico del proyecto: Lesiones/sanciones masivas o corrupción Core pueden llevar a planteles vacíos que siguen simulando.

## [ME-006] 🟠 MAYOR
Archivo: `src/matchEngine.js` (líneas aprox. 413-456)  
Sistema: Live match / reproducibilidad  
Descripción: `createLiveMatch()` guarda `seed`, pero `restoreRNGFromLiveMatch()` reinicia el RNG al seed inicial, no a un estado avanzado por minuto ya jugado.  
Impacto: Guardar/cargar a mitad de partido puede divergir al continuar desde el minuto actual.  
Contexto específico del proyecto: El live match de Colo-Colo conserva minuto y timeline, pero el RNG vuelve al inicio del seed.

## [ME-007] 🟡 MENOR
Archivo: `src/matchEngine.js` (líneas aprox. 59-69)  
Sistema: Estadísticas de partido  
Descripción: `emptyStats()` inicia `possession: 50`, pero el match result offline no evidencia actualización final de posesión en el bloque inspeccionado.  
Impacto: El HUD puede mostrar posesión estática o poco expresiva.  
Contexto específico del proyecto: Partidos simulados de liga pueden terminar con posesión base aunque existan goles, xG y remates.

## [ME-008] 🟡 MENOR
Archivo: `src/table.js` (líneas aprox. 48-54)  
Sistema: Tabla / desempates  
Descripción: El desempate usa puntos, diferencia de gol, goles a favor y nombre alfabético; no contempla enfrentamiento directo.  
Impacto: La clasificación puede diferir de reglas deportivas esperadas o de criterios reales si todos los valores principales empatan.  
Contexto específico del proyecto: Dos equipos chilenos igualados pueden definirse por `localeCompare`.

---

# ════════════════════════════════════════════════════════════
# CAPA 3 — INGENIERÍA FRONTEND Y ARQUITECTURA WEB
# ════════════════════════════════════════════════════════════

## [FE-001] 🟠 MAYOR
Archivo: `index.html` (contexto orden de scripts)  
Sistema: Carga secuencial sin bundler  
Descripción: El proyecto depende de más de 65 scripts síncronos en orden fijo. No existe verificación automática del grafo de dependencias del HTML.  
Impacto: Un cambio de orden puede romper módulos IIFE sin error de build previo.  
Contexto específico del proyecto: `immersionIntegration.js` puede requerir `FMG.Core.Utils` en runtime si se carga en un bundle alternativo sin Core Utils.

## [FE-002] 🟠 MAYOR
Archivo: `src/main.js` (líneas aprox. 199-204)  
Sistema: Render SPA  
Descripción: Cada render reemplaza `app.innerHTML` completo.  
Impacto: Riesgo de nodos detachados, pérdida de foco, costo de layout alto y resincronización compleja de canvas/visualizador.  
Contexto específico del proyecto: La vista de partido live y `match-visualizer-container` dependen de reinit/sync después de cada render.

## [FE-003] 🟠 MAYOR
Archivo: `src/saveSystem.js` (líneas aprox. 76-82)  
Sistema: Persistencia síncrona frontend  
Descripción: `JSON.stringify()` y `localStorage.setItem()` ocurren en el hilo principal.  
Impacto: Saves grandes bloquean la UI.  
Contexto específico del proyecto: Stress previo produjo saves de 4.6 MB a 25 temporadas y 7.5 MB a 50 temporadas forzadas.

## [FE-004] 🟡 MENOR
Archivo: `src/main.js` (líneas aprox. 441-447)  
Sistema: Input / acciones UI  
Descripción: Existe un throttle global de clicks de 300 ms para todas las acciones.  
Impacto: Comandos rápidos legítimos pueden ser ignorados.  
Contexto específico del proyecto: Cambios tácticos y órdenes live usan el mismo bus de `data-action`.

## [FE-005] 🟡 MENOR
Archivo: `src/main.js` (líneas aprox. 24-36)  
Sistema: Fetch de seed data  
Descripción: `Promise.all()` falla globalmente si uno de los dos JSON falla; no hay timeout de carga.  
Impacto: Una carga parcial o request colgado deja al usuario en pantalla de error/carga sin diferenciación del recurso fallido.  
Contexto específico del proyecto: `teams.json` y `players.json` son ambos obligatorios para iniciar.

## [FE-006] 🟡 MENOR
Archivo: `src/gameState.js` (líneas aprox. 14-55)  
Sistema: Namespace global  
Descripción: `FMG.gameState` mutable convive con `FMG.Core.engine` y estados separados, sin barrera fuerte contra escrituras cruzadas.  
Impacto: Riesgo de doble fuente de verdad durante migración Core.  
Contexto específico del proyecto: Legacy y Core están activos simultáneamente en browser tras `FMG.Core.initialize()`.

## [FE-007] 🔵 OBSERVACIÓN
Archivo: `index.html` (línea aprox. 9)  
Sistema: Metadata social  
Descripción: `og:image` referencia `./assets/og-preview.png`, archivo no existente.  
Impacto: Preview social roto en WhatsApp, Twitter/X, Facebook y Discord.  
Contexto específico del proyecto: `assets/` solo contiene `icons.svg`.

---

# ════════════════════════════════════════════════════════════
# CAPA 4 — MOTOR 3D Y VISUAL
# ════════════════════════════════════════════════════════════

## [VIS-001] 🟠 MAYOR [CONOCIDO Q6]
Archivo: `src/matchVisualizer.js` (líneas aprox. 583-591, 628-645)  
Sistema: Loop visual / lifecycle  
Descripción: Existe loop RAF propio en el visualizador y dispose cancela `animationFrameId`, pero el diseño permite coexistencia con loops de fases y playback si no se invoca dispose desde todos los flujos.  
Impacto: Riesgo de loops visuales concurrentes y consumo oculto.  
Contexto específico del proyecto: `main.js` llama dispose al terminar live match, pero cambios de ruta y recuperación visual dependen de rutas específicas.

## [VIS-002] 🟠 MAYOR
Archivo: `src/MatchPlaybackEngine.js` (líneas aprox. 481-502)  
Sistema: Playback / animación  
Descripción: Playback tiene loop RAF independiente del visualizador.  
Impacto: Puede duplicar frecuencia de render si se usa junto a visualizador activo.  
Contexto específico del proyecto: Replays fase 20 y match visual live pueden existir como sistemas conceptualmente separados.

## [VIS-003] 🟡 MENOR
Archivo: `src/matchVisualizer.js` (líneas aprox. 420-440)  
Sistema: Visualizador táctico  
Descripción: El visualizador inspeccionado usa canvas 2D táctico, mientras documentación y stack prometen Three.js/3D.  
Impacto: Discrepancia entre expectativa visual y runtime real del partido canónico.  
Contexto específico del proyecto: Fases 15-24 son sandbox y no la fuente visual canónica de carrera.

## [VIS-004] 🟡 MENOR
Archivo: `src/phase23/StadiumAudio.js` (líneas aprox. 8, 27)  
Sistema: Audio Web API  
Descripción: AudioContext se crea en constructor y luego se intenta `resume()`.  
Impacto: Navegadores con políticas de autoplay pueden mantener audio suspendido si la creación ocurre antes de gesto válido.  
Contexto específico del proyecto: `menuAudio` se inicia desde `ensureMenuAudio()` al click global, pero el lifecycle posterior no queda vinculado a cambios de modo.

## [VIS-005] 🟡 MENOR
Archivo: `src/phase16/HUDSystem.js` (contexto Q1 documentado)  
Sistema: HUD fase 16  
Descripción: El TODO conocido fue descrito como deuda de responsabilidad de render canvas 2D; aunque tests actuales no detectan TODO ambiguo, el área sigue documentada como deuda histórica.  
Impacto: Riesgo de cobertura visual incompleta en sandbox fase 16.  
Contexto específico del proyecto: Fase 16 no afecta carrera, pero aparece como “Jugar v2” en modo dev.

## [VIS-006] 🔵 OBSERVACIÓN
Archivo: `index.html` (línea aprox. 23)  
Sistema: Canvas oculto  
Descripción: `#match-canvas` existe con `display:none` y sin dimensiones CSS explícitas.  
Impacto: Inicializaciones que dependan de dimensiones reales pueden calcular tamaño 0 si usan ese canvas directamente.  
Contexto específico del proyecto: Las fases crean sus propios canvas, pero el canvas global permanece como superficie potencial.

## [VIS-007] 🔵 OBSERVACIÓN
Archivo: `src/phase15/game.js`, `src/phase16/constants.js`, `src/matchEngine.js`  
Sistema: Coherencia visual/lógica  
Descripción: Motores sandbox usan constantes y físicas propias separadas del match engine canónico.  
Impacto: La experiencia visual puede enseñar reglas no equivalentes a la simulación de carrera.  
Contexto específico del proyecto: [CONOCIDO Q4] doble fuente de verdad entre sandbox visual y manager canon.

---

# ════════════════════════════════════════════════════════════
# CAPA 5 — UX / INTERFAZ DE USUARIO
# ════════════════════════════════════════════════════════════

## [UX-001] 🟠 MAYOR
Archivo: `src/main.js` (líneas aprox. 234-243)  
Sistema: Navegación durante fases visuales  
Descripción: El desmontaje de fases depende de comprobar la ruta actual antes de cambiar a la siguiente.  
Impacto: Cualquier cambio de estado de ruta fuera de ese handler puede dejar fase montada.  
Contexto específico del proyecto: Todas las vistas phase15-phase24 dependen de `FMG.unmountPhaseXX()`.

## [UX-002] 🟠 MAYOR
Archivo: `src/main.js` (líneas aprox. 145-155, 199-204)  
Sistema: Partido live / navegación  
Descripción: Durante partido live el usuario puede navegar a otras secciones; el timer live sigue dependiendo de `scheduleLivePlaybackLoop()` y render global.  
Impacto: Riesgo de desorientación y UI desincronizada entre partido activo y vista no-partido.  
Contexto específico del proyecto: `livePlaybackTimer` avanza partido mientras la ruta puede ser finanzas, mercado o carrera.

## [UX-003] 🟡 MENOR
Archivo: `ui/onboardingView.js` (archivo pequeño, contexto completo)  
Sistema: Onboarding  
Descripción: El onboarding cubre pasos básicos, pero no explica profundidad de finanzas, saves, live match, fases sandbox ni diferencia legacy/Core.  
Impacto: Nuevo usuario puede no entender alcance real del manager.  
Contexto específico del proyecto: Beta pública fase 24 con muchas secciones visibles.

## [UX-004] 🟡 MENOR
Archivo: `src/main.js` (flujo `advance-week`)  
Sistema: Feedback de simulación  
Descripción: No hay estado de carga intermedio para simulación semanal completa; el proceso es síncrono.  
Impacto: En mundos grandes, la UI puede parecer congelada.  
Contexto específico del proyecto: Base grande auditada: ~502 ms por semana simulada en Node.

## [UX-005] 🟡 MENOR
Archivo: `ui/newsView.js` (líneas aprox. 97, 127)  
Sistema: Estados vacíos  
Descripción: Algunas áreas de noticias tienen estado vacío, pero otras secciones avanzadas dependen de objetos opcionales y texto genérico.  
Impacto: Inicio de partida puede sentirse parcialmente vacío o inconsistente.  
Contexto específico del proyecto: `worldNews`, rivalidades y press questions nacen vacíos.

## [UX-006] 🔵 OBSERVACIÓN
Archivo: `css/styles.css` (líneas aprox. 1-16, 20-31)  
Sistema: Tema visual  
Descripción: `--bg` oscuro convive con fondo real claro por gradientes en `body`.  
Impacto: Riesgo de contraste inconsistente si componentes usan `--bg` directamente.  
Contexto específico del proyecto: UI principal es clara, pero variable raíz sugiere base oscura.

---

# ════════════════════════════════════════════════════════════
# CAPA 6 — GUARDADO Y PERSISTENCIA
# ════════════════════════════════════════════════════════════

## [PER-001] 🔴 CRÍTICO
Archivo: `src/saveSystem.js` (líneas aprox. 76-82)  
Sistema: localStorage / cuota  
Descripción: El guardado escribe estado completo en localStorage sin estimación previa de tamaño.  
Impacto: Riesgo de `QuotaExceededError`, save fallido o pérdida de slot en temporadas largas.  
Contexto específico del proyecto: Save de 50 temporadas forzadas alcanzó ~7.5 MB; 4 slots + autosave pueden superar límites comunes.

## [PER-002] 🟠 MAYOR
Archivo: `src/saveSystem.js` (líneas aprox. 78-82)  
Sistema: Escritura transaccional  
Descripción: El sistema usa `.bak` y `.tmp`, pero todas las escrituras son localStorage síncronas y no atómicas entre pestañas.  
Impacto: Dos pestañas pueden sobrescribir índice y slots sin control de concurrencia.  
Contexto específico del proyecto: `SAVE_INDEX_KEY`, slot activo y autosave comparten namespace global.

## [PER-003] 🟠 MAYOR
Archivo: `src/FMG.Core/Adapters/LegacyGameStateAdapter.js` (líneas aprox. 115-152)  
Sistema: Migración Core/legacy  
Descripción: El adaptador no es lossless para saves legacy; al volver desde Core descarta campos usados por módulos legacy.  
Impacto: Carga futura desde estado migrado puede degradar datos de club, jugadores y economía.  
Contexto específico del proyecto: Afecta directamente a saves fase pública 24 tras activar Core.

## [PER-004] 🟠 MAYOR
Archivo: `src/saveSystem.js` (líneas aprox. 42-49, 188-190)  
Sistema: Import externo  
Descripción: `validateImportedSave()` valida pocas invariantes: balance máximo y overall de jugadores; no valida fixtures, equipos, standings, referencias cruzadas ni schema completo.  
Impacto: JSON estructuralmente incompleto puede entrar a migración.  
Contexto específico del proyecto: Import de partidas desde archivo puede contener equipos sin fixtures válidos.

## [PER-005] 🟡 MENOR
Archivo: `src/FMG.Core/Repository/GameStateRepository.js` (línea aprox. 139)  
Sistema: Repositorio Core  
Descripción: Existen stubs de IndexedDB documentados como futuro enhancement.  
Impacto: API de persistencia Core aparenta capacidades no implementadas.  
Contexto específico del proyecto: Desktop/futuro escalado necesitaría capa persistente real, pero el repo actual cae en localStorage/memoria.

## [PER-006] 🟡 MENOR
Archivo: `src/utils.js` (líneas aprox. 8-10)  
Sistema: Versionado  
Descripción: `CURRENT_VERSION` depende de `typeof document`, dando 13 en Node y 24 en browser.  
Impacto: Tests y browser operan con versiones distintas de save.  
Contexto específico del proyecto: Saves generados en pruebas Node no reflejan exactamente versión pública browser.

## [PER-007] 🔵 OBSERVACIÓN
Archivo: `src/saveSystem.js` (líneas aprox. 182-190)  
Sistema: Export/import  
Descripción: Export usa JSON completo y Blob en browser; no existe evidencia de validación específica Safari/iOS.  
Impacto: Compatibilidad de descarga puede variar por navegador.  
Contexto específico del proyecto: El juego declara ejecución en navegador moderno.

---

# ════════════════════════════════════════════════════════════
# CAPA 7 — QA Y ASEGURAMIENTO DE CALIDAD
# ════════════════════════════════════════════════════════════

## [QA-001] 🟠 MAYOR
Archivo: `tests/` y `package.json`  
Sistema: Cobertura end-to-end browser  
Descripción: `npm test` ejecuta Node VM, no un browser real como parte del pipeline.  
Impacto: Errores de carga de index.html, CSS, fetch, WebAudio, WebGL o DOM real no bloquean CI local.  
Contexto específico del proyecto: La auditoría usó Chrome CDP manual; no forma parte de `npm test`.

## [QA-002] 🟠 MAYOR
Archivo: `tests/stabilization.test.js`  
Sistema: Stress tests  
Descripción: El test de estabilización valida diagnósticos unitarios, pero no simula 10+ temporadas de juego real.  
Impacto: Crecimiento de saves, despido de manager, retención de retirados y degradación de largo plazo no fallan tests.  
Contexto específico del proyecto: 25 temporadas tardaron ~94 s y save llegó a ~4.6 MB fuera del suite.

## [QA-003] 🟠 MAYOR
Archivo: `tests/phase15_16_17_smoke.test.js`  
Sistema: Smoke visual  
Descripción: Smoke tests verifican presencia/ausencia de escrituras canónicas, pero no cubren todos los dispose/RAF de fases 18-24.  
Impacto: Leaks de loops visuales avanzados pueden escapar.  
Contexto específico del proyecto: Fases 20-24 tienen cámaras, audio, HUD y tácticas adicionales.

## [QA-004] 🟡 MENOR
Archivo: `package.json`  
Sistema: Calidad estática  
Descripción: `npm test` no ejecuta ESLint.  
Impacto: `no-unused-vars`, `no-undef` y `eqeqeq` pueden no bloquear regresiones.  
Contexto específico del proyecto: `.eslintrc.json` existe con reglas, pero no se invoca desde script.

## [QA-005] 🟡 MENOR
Archivo: `tests/`  
Sistema: Edge cases deportivos  
Descripción: No se observó test específico para plantilla con 0 disponibles, empate total de tabla, balance negativo extremo o reputación 0.  
Impacto: Casos borde relevantes del manager pueden romperse sin detección automática.  
Contexto específico del proyecto: Core puede producir plantel vacío, pero suite completa siguió pasando.

## [QA-006] 🔵 OBSERVACIÓN
Archivo: `tests/phase2_architecture.test.js` (línea aprox. 86)  
Sistema: Save corrupto  
Descripción: Existe prueba de fallback con slot corrupto, pero no cubre cuota localStorage, multi-tab ni import externo hostil.  
Impacto: Cobertura de persistencia es parcial.  
Contexto específico del proyecto: localStorage es el backend principal de producción.

---

# ════════════════════════════════════════════════════════════
# CAPA 8 — DATOS DE FÚTBOL Y PRECISIÓN DEPORTIVA
# ════════════════════════════════════════════════════════════

## [DATA-001] 🟠 MAYOR
Archivo: `data/teams.json` (línea aprox. 4)  
Sistema: Datos de clubes  
Descripción: Universidad Católica figura con `stadium: "Santa Laura"`.  
Impacto: Error factual visible al usuario.  
Contexto específico del proyecto: La UI muestra estadio en dashboard y selector de club.

## [DATA-002] 🟡 MENOR
Archivo: `data/teams.json` (línea aprox. 6)  
Sistema: Datos de clubes  
Descripción: Huachipato usa `stadium: "CAP"`, nombre incompleto/informal.  
Impacto: Menor precisión deportiva.  
Contexto específico del proyecto: Vista dashboard muestra `Estadio CAP`.

## [DATA-003] 🟡 MENOR
Archivo: `data/teams.json` (líneas aprox. 2-8)  
Sistema: Escala económica  
Descripción: `budget`, `sponsor`, `fanBase` no declaran unidad ni fuente.  
Impacto: Ambigüedad de interpretación CLP/millones.  
Contexto específico del proyecto: `FMG.currency()` muestra valores grandes como `$145,0 M`, sin explicar moneda.

## [DATA-004] 🟠 MAYOR
Archivo: `data/players.json`, `src/gameEngine.js` (contexto `ensureSquadDepth`)  
Sistema: Datos seed  
Descripción: Colo-Colo tiene 18 jugadores seed, otros clubes base tienen 5 y dependen de relleno procedural.  
Impacto: Desbalance de calidad/identidad de plantel inicial.  
Contexto específico del proyecto: U. de Chile, UC, Cobreloa, Huachipato, Palestino y Wanderers son completados con generados.

## [DATA-005] 🟡 MENOR
Archivo: `src/gameEngine.js` (contexto `fallbackNames`)  
Sistema: Generación de jugadores  
Descripción: Solo existen 15 nombres fallback para planteles de hasta 18 generados por equipo.  
Impacto: Repetición de nombres dentro o entre equipos.  
Contexto específico del proyecto: Equipos de expansión como Ñublense o La Serena pueden tener nombres duplicados.

## [DATA-006] 🟡 MENOR
Archivo: `data/players.json`  
Sistema: Modelo de jugador  
Descripción: Seed base no incluye nacionalidad, pie dominante, subposición, contrato avanzado ni atributos desglosados; se completan en runtime.  
Impacto: Datos deportivos poco expresivos antes de migración/enriquecimiento.  
Contexto específico del proyecto: Posiciones se reducen a POR/DEF/MED/EXT/DEL.

## [DATA-007] 🔵 OBSERVACIÓN
Archivo: `src/gameEngine.js` (contexto `expansionTeams`)  
Sistema: Set de liga  
Descripción: El set de expansión mezcla equipos sin marcar temporada/base de datos oficial.  
Impacto: Precisión contextual variable respecto de una temporada real específica.  
Contexto específico del proyecto: El juego se presenta como chileno, pero no documenta año competitivo de referencia.

---

# ════════════════════════════════════════════════════════════
# CAPA 9 — RENDIMIENTO Y OPTIMIZACIÓN WEB
# ════════════════════════════════════════════════════════════

## [PERF-001] 🔴 CRÍTICO
Archivo: `src/saveSystem.js`, `src/gameEngine.js`, `src/squad.js`  
Sistema: Escalabilidad de saves  
Descripción: La simulación de largo plazo mantiene jugadores retirados y serializa estado completo.  
Impacto: Riesgo directo de superar localStorage y congelar UI.  
Contexto específico del proyecto: 50 temporadas forzadas produjeron 7.5 MB y 675 retirados retenidos.

## [PERF-002] 🟠 MAYOR
Archivo: `src/simulationScheduler.js` (líneas aprox. 24-45)  
Sistema: Scheduler  
Descripción: `runDue()` ejecuta todos los jobs vencidos sin yielding ni `requestIdleCallback`.  
Impacto: Jobs pesados bloquean el hilo principal.  
Contexto específico del proyecto: News, scouting, transfers, injuries y economy corren post-semana.

## [PERF-003] 🟠 MAYOR
Archivo: `src/gameEngine.js`, `src/transfers.js`, `src/news.js`  
Sistema: Simulación semanal  
Descripción: Base grande auditada de 66 equipos / 1.691 jugadores tardó ~502 ms por semana.  
Impacto: En low-end hardware la simulación semanal puede sentirse congelada.  
Contexto específico del proyecto: Requisito objetivo incluye AMD FX y HDD.

## [PERF-004] 🟡 MENOR
Archivo: `src/ecs.js`  
Sistema: ECS  
Descripción: ECS existe y tiene tests, pero el manager canónico no parece depender de él para temporada/mercado/carrera.  
Impacto: Deuda arquitectural potencial.  
Contexto específico del proyecto: `phase2_architecture.test.js` prueba ECS aislado, no integración manager.

## [PERF-005] 🟡 MENOR
Archivo: `src/performance.js`  
Sistema: Profiling  
Descripción: Profiler existe, pero no está integrado como presupuesto obligatorio para simulación semanal legacy.  
Impacto: Spikes de CPU pueden pasar sin degradación automática en gameplay principal.  
Contexto específico del proyecto: Large-world audit reveló semana de ~502 ms.

## [PERF-006] 🔵 OBSERVACIÓN
Archivo: `src/matchVisualizer.js` (líneas aprox. 420-440)  
Sistema: Canvas resize  
Descripción: Canvas táctico se redimensiona por resize handler, pero su costo no está ligado a una política de FPS adaptativa.  
Impacto: Rendimiento visual depende del dispositivo.  
Contexto específico del proyecto: Mobile/retina no tienen presupuesto visual explícito en este renderer.

---

# ════════════════════════════════════════════════════════════
# CAPA 10 — ACCESIBILIDAD Y COMPATIBILIDAD
# ════════════════════════════════════════════════════════════

## [ACC-001] 🟠 MAYOR
Archivo: `index.html`, `src/matchVisualizer.js`, fases visuales  
Sistema: Compatibilidad gráfica  
Descripción: No se observa fallback global de no-WebGL para features Three.js/sandbox.  
Impacto: Usuarios sin WebGL funcional pueden ver fallos o features inaccesibles.  
Contexto específico del proyecto: Chrome/Firefox/Edge modernos son objetivo, pero low-end GPU está declarado como requisito.

## [ACC-002] 🟡 MENOR
Archivo: `src/main.js`, módulos `ui/*.js`  
Sistema: Teclado / navegación  
Descripción: La app depende de botones `data-action`, pero no se evidencia auditoría completa de Tab/Enter/Space ni gestión de foco post-render.  
Impacto: Navegación con teclado puede degradarse tras rerender total.  
Contexto específico del proyecto: `render()` reemplaza `innerHTML` completo.

## [ACC-003] 🟡 MENOR
Archivo: `css/styles.css` (variables raíz)  
Sistema: Contraste  
Descripción: No hay evidencia de test automático WCAG para `--primary`, `--muted`, chips y textos sobre gradientes.  
Impacto: Riesgo de contraste insuficiente en estados secundarios.  
Contexto específico del proyecto: Mucha información de manager se muestra en `.muted`, chips y cards.

## [ACC-004] 🟡 MENOR
Archivo: `src/uiAudio.js`, `src/phase23/StadiumAudio.js`  
Sistema: Web Audio  
Descripción: Audio depende de políticas modernas de interacción; compatibilidad Safari/iOS no está validada por tests.  
Impacto: Audio de menú/estadio puede no reproducirse.  
Contexto específico del proyecto: Fase 23 se presenta como audio de partido.

## [ACC-005] 🔵 OBSERVACIÓN
Archivo: `css/styles.css`  
Sistema: Preferencias de usuario  
Descripción: No existe `prefers-color-scheme` ni evidencia de modo oscuro.  
Impacto: La app no responde a preferencia visual del sistema.  
Contexto específico del proyecto: UI siempre clara.

---

# ════════════════════════════════════════════════════════════
# CAPA 11 — LOCALIZACIÓN Y CONTEXTO CHILENO
# ════════════════════════════════════════════════════════════

## [LOC-001] 🟡 MENOR
Archivo: múltiples `src/*.js`, `ui/*.js`  
Sistema: Strings visibles  
Descripción: La mayoría del texto visible está en español, pero hay etiquetas internas que pueden filtrarse como `balanced`, `rotation`, `starter`, `pending`, `ai-buy`.  
Impacto: Inconsistencia lingüística si esos estados aparecen en UI avanzada.  
Contexto específico del proyecto: `marketView.js` muestra `negotiation.type` y `negotiation.status` sanitizados pero no necesariamente traducidos.

## [LOC-002] 🟡 MENOR
Archivo: `src/utils.js` (líneas aprox. 79-89)  
Sistema: Moneda  
Descripción: Valores sobre 1M se muestran como `$145,0 M` sin sufijo CLP explícito.  
Impacto: Ambigüedad de escala monetaria.  
Contexto específico del proyecto: Presupuestos chilenos se interpretan como CLP pero la UI abrevia.

## [LOC-003] 🔵 OBSERVACIÓN
Archivo: `data/players.json`, `src/gameEngine.js`  
Sistema: Jugadores ficticios  
Descripción: No se observa aviso persistente en UI de que todos los jugadores son ficticios.  
Impacto: Posible confusión con personas reales si nombres coinciden.  
Contexto específico del proyecto: Nombres como Matías Navarro o Felipe Bustos son plausibles en Chile.

## [LOC-004] 🔵 OBSERVACIÓN
Archivo: `src/news.js`, `README.md`  
Sistema: Contexto competitivo  
Descripción: “Copa internacional” no se especifica como Libertadores, Sudamericana u otra competición.  
Impacto: Menor precisión cultural/deportiva.  
Contexto específico del proyecto: Carrera registra `Titulo internacional` genérico.

---

# ════════════════════════════════════════════════════════════
# CAPA 12 — PRODUCCIÓN Y COMPLETITUD
# ════════════════════════════════════════════════════════════

## [PROD-001] 🟠 MAYOR
Archivo: `index.html` (línea aprox. 9), `assets/`  
Sistema: Asset release  
Descripción: `./assets/og-preview.png` no existe.  
Impacto: Social preview roto en producción.  
Contexto específico del proyecto: `assets/` solo contiene `icons.svg`.

## [PROD-002] 🟡 MENOR
Archivo: `ui/phase15View.js` a `ui/phase24View.js`  
Sistema: Presentación de fases experimentales  
Descripción: En modo dev las fases aparecen como “Jugar v1” a “Jugar v10”, no como sandbox experimental dentro de la navegación.  
Impacto: Puede interpretarse como escalera de features completas.  
Contexto específico del proyecto: Documentación dice que fases 15-24 no afectan carrera.

## [PROD-003] 🟡 MENOR
Archivo: `package.json`, UI  
Sistema: Metadata de versión  
Descripción: `package.json` declara `0.1.0`, pero no se observa exposición clara de versión dentro del juego.  
Impacto: Soporte y reporte de bugs pierden contexto de build.  
Contexto específico del proyecto: Beta pública fase 24.

## [PROD-004] 🟡 MENOR
Archivo: `IMMUTABLE_ARCHITECTURE_EXECUTION_SUMMARY.txt`, `FMG_CORE_VERIFICATION.md`  
Sistema: Documentación vs estado actual  
Descripción: Documentos declaran verificaciones históricas que no necesariamente reflejan el conteo actual de tests ni los riesgos nuevos del puente Core.  
Impacto: Documentación puede sobrestimar estabilidad real.  
Contexto específico del proyecto: Auditoría detectó corrupción Core↔legacy pese a tests passing.

## [PROD-005] 🔵 OBSERVACIÓN
Archivo: `ui/creditsView.js`  
Sistema: Créditos  
Descripción: Vista de créditos es breve y no expone metadata completa de release, licencia, versión o terceros en detalle.  
Impacto: Incompletitud de presentación pública.  
Contexto específico del proyecto: Three.js CDN es dependencia visible en producción.

## [PROD-006] 🔵 OBSERVACIÓN
Archivo: `README.md`  
Sistema: Declaración de estado  
Descripción: “fase pública 24” puede sugerir que todos los módulos hasta fase 24 son producción completa, aunque fases 15-24 son sandbox experimental.  
Impacto: Expectativa pública potencialmente ambigua.  
Contexto específico del proyecto: La carrera canónica sigue en fases 0-13; visual sandbox no persiste standings.

---

# ════════════════════════════════════════════════════════════
# MATRIZ DE RIESGO GLOBAL
# ════════════════════════════════════════════════════════════

| ID | Capa | Archivo | Severidad | Impacto jugador | Impacto estabilidad |
|---|---|---|---|---|---|
| DS-001 | Game Design | `src/gameEngine.js` | 🔴 | Alto | Alto |
| DS-002 | Game Design | `src/gameEngine.js` | 🟠 | Medio | Alto |
| DS-003 | Game Design | `src/gameEngine.js` | 🟠 | Medio | Medio |
| DS-004 | Game Design | `src/gameEngine.js` | 🟠 | Medio | Medio |
| DS-005 | Game Design | `src/finances.js` | 🟠 | Medio | Medio |
| ME-001 | Match/Core | `src/FMG.Core/Engine/SimulationEngine.js` | 🔴 | Alto | Alto |
| ME-002 | Match/Core | `src/FMG.Core/Adapters/LegacyGameStateAdapter.js` | 🔴 | Alto | Alto |
| ME-003 | Match/Core | `src/FMG.Core/Engine/GameState.js` | 🟠 | Medio | Alto |
| ME-004 | Match/Core | `src/FMG.Core/Engine/SimulationEngine.js` | 🟠 | Medio | Alto |
| ME-006 | Match/Core | `src/matchEngine.js` | 🟠 | Medio | Alto |
| FE-003 | Frontend | `src/saveSystem.js` | 🟠 | Alto | Medio |
| PER-001 | Persistencia | `src/saveSystem.js` | 🔴 | Alto | Alto |
| PER-002 | Persistencia | `src/saveSystem.js` | 🟠 | Alto | Alto |
| PER-003 | Persistencia | `LegacyGameStateAdapter.js` | 🟠 | Alto | Alto |
| PERF-001 | Rendimiento | varios | 🔴 | Alto | Alto |
| QA-001 | QA | `package.json` | 🟠 | Medio | Alto |
| DATA-001 | Datos | `data/teams.json` | 🟠 | Medio | Bajo |
| PROD-001 | Producción | `index.html` | 🟠 | Medio | Bajo |

---

# ════════════════════════════════════════════════════════════
# NOTA FINAL
# ════════════════════════════════════════════════════════════

Este reporte contiene únicamente detección de problemas.  
No incluye soluciones ni recomendaciones de corrección.  
Todas las capas fueron auditadas como sistemas independientes.  
Proyecto auditado: Football Manager Chile — Vanilla JS SPA, Three.js r128, localStorage, fases 0-24.  

# ════════════════════════════════════════════════════════════
