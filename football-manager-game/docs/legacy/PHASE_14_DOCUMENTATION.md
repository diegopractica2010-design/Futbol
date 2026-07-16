# Fase 14 - Motor Visual de Partido Optimizado
## Documentación Técnica Completa

---

## 1. VISIÓN GENERAL

**Objetivo:** Transformar partidos simulados en partidos visibles en 3D, manteniendo:
- Fluidez 60 FPS como requisito absoluto
- Simplicidad visual (no AAA, pero profesional)
- Integración seamless con sistema existente

**Stack Elegido:** Three.js r128 + JavaScript vanilla
- Mejor opción que Godot: mantiene arquitectura web unificada
- No requiere compilación, hot-reload fácil
- WebGL compatible con navegadores modernos

---

## 2. ESTRUCTURA DE ARCHIVOS

```
football-manager-game/
├── src/
│   ├── matchVisualizer.js          [NUEVO] Motor 3D core
│   ├── matchVisualController.js    [NUEVO] Orquestador eventos
│   ├── main.js                     [MODIFICADO] Evento start-live-match
│   ├── gameEngine.js               [PRÓXIMO] addLiveMinuteEvent hook
│   └── matchEngine.js              [PRÓXIMO] simulateMatch hook
├── ui/
│   └── matchView.js                [MODIFICADO] Contenedor 3D
├── css/
│   └── styles.css                  [MODIFICADO] Estilos canvas
├── index.html                      [MODIFICADO] Three.js CDN + scripts
└── data/
    ├── teams.json
    └── players.json
```

---

## 3. ARQUITECTURA TÉCNICA

### 3.1 MatchVisualizer (src/matchVisualizer.js)

```
Responsabilidades:
- Gestionar escena Three.js
- Renderizado 60 FPS con requestAnimationFrame
- Pool de geometrías y materiales
- Animación fluida de objetos
```

**Atributos clave:**
```javascript
class MatchVisualizer {
  scene            // THREE.Scene
  camera           // THREE.PerspectiveCamera (broadcast lateral)
  renderer         // THREE.WebGLRenderer (compatible mode)
  players          // Map<playerId, {mesh, visualId, isHome}>
  ball             // THREE.Mesh (esfera blanca)
  field            // THREE.Mesh (pasto)
  config           // Dimensiones, FPS target, etc
  deltaTime        // Para sincronización temporal
  lastFrameTime    // Performance.now()
}
```

**Métodos principales:**

| Método | Propósito | Parámetros |
|--------|-----------|-----------|
| `init()` | Inicializar escena, cámara, renderer | - |
| `addPlayer()` | Crear cápsula de jugador en cancha | playerId, position, isHome |
| `createBall()` | Crear esfera de balón | - |
| `animatePlayerMove()` | Animar movimiento jugador A→B | playerId, targetPos, duration |
| `animateBallMove()` | Animar balón con arco parabólico | targetPos, duration, arcHeight |
| `animateShot()` | Tiro rápido (sin arco) | targetPos, duration |
| `updateMatchState()` | Actualizar marcador, minuto, etc | minute, goals, possession |
| `dispose()` | Limpiar recursos WebGL | - |

**Geometría de Cancha:**
```
Dimensiones reales: 105m x 68m
PlaneGeometry escalado
Líneas con LineBasicMaterial
- Línea media horizontal
- Áreas de gol 40x16.5m
- Línea límite
```

### 3.2 MatchVisualController (src/matchVisualController.js)

```
Responsabilidades:
- Orquestar ciclo de vida del visualizador
- Sincronizar eventos del partido con animaciones
- Convertir datos del liveMatch a posiciones 3D
```

**Atributos:**
```javascript
class MatchVisualController {
  visualizer       // Instancia MatchVisualizer
  matchState       // {homeTeamId, awayTeamId, homeGoals, ...}
  eventQueue       // Cola de eventos pendientes
  isProcessingEvents // Flag para evitar race conditions
}
```

**Métodos principales:**

| Método | Propósito |
|--------|-----------|
| `initMatch()` | Crear visualizador y posicionar jugadores iniciales |
| `updateMatchState()` | Sincronizar datos de partido |
| `queueEvent()` | Agregar evento a cola (pass, shot, goal, foul) |
| `processEventQueue()` | Procesar eventos secuencialmente con delay |
| `animatePass()` | Animar pase (balón A→B) |
| `animateShot()` | Animar tiro |
| `animateGoal()` | Animar gol (celebración) |
| `dispose()` | Destruir visualizador |

**Flujo de Eventos:**
```
Player action en partido simulado
    ↓
queueEvent("pass", {fromPlayer, toPlayer})
    ↓
eventQueue.push()
    ↓
processEventQueue() (async)
    ↓
animatePass() -> animateBallMove() (400ms)
    ↓
Siguiente evento (200ms delay)
```

### 3.3 Integración con Sistema Existente

#### En main.js:
```javascript
// Línea ~109 (modificada)
if (action === "start-live-match") {
  FMG.pushNotification(FMG.startLiveUserMatch().message);
  setTimeout(() => {
    const container = document.querySelector("#match-visualizer-container");
    if (container && FMG.gameState.liveMatch) {
      FMG.matchVisualController.initMatch(
        container,
        FMG.gameState.liveMatch,
        FMG.gameState
      );
    }
  }, 50); // Wait for DOM render
}
```

#### En matchView.js:
```html
<!-- Línea ~62 (nuevo) -->
<div id="match-visualizer-container" 
     style="width:100%;height:500px;..."></div>
```

#### En index.html:
```html
<!-- Three.js CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- Orden de scripts (CRÍTICO) -->
<script src="./src/matchVisualizer.js"></script>
<script src="./src/matchVisualController.js"></script>
```

---

## 4. OPTIMIZACIÓN PARA 60 FPS

### 4.1 Estrategias Implementadas

| Técnica | Detalle | Estado |
|---------|--------|--------|
| RequestAnimationFrame | Sincronización con vsync navegador | ✅ |
| Pixel Ratio Limitado | Máx 1.5x en pantallas altas | ✅ |
| Sin sombras | Deshabilitadas en renderer | ✅ |
| Geometría simple | Cápsulas 4-seg en lugar de 32+ | ✅ |
| Materiales Phong | Sin PBR complejo | ✅ |
| Culling automático | THREE.js frustum culling | ✅ |
| Delta time constante | Interpolación basada en tiempo | ✅ |

### 4.2 Monitoreo FPS

```javascript
// En startRendering()
this.hud.fps = Math.round(1000 / this.deltaTime);

// Mostrar en HUD (desarrollo):
console.log(`FPS: ${this.hud.fps}`);
```

### 4.3 Proyecciones de Performance

**Hardware objetivo:**
- Laptop 2018 (Intel i5, GTX 1050): 45-60 FPS
- Navegador web moderno: 60 FPS

**Escalada futura (si es necesario):**
```javascript
// LOD (Level of Detail) - no implementado aún
if (distance > 50) {
  // Simplificar geometría jugadores lejanos
  useLowPolyPlayer();
} else {
  useNormalPlayer();
}
```

---

## 5. FLUJO DE INICIALIZACIÓN

```
Usuario: Click en "Jugar partido"
    ↓
main.js: handleAction("start-live-match")
    ↓
gameEngine.js: startLiveUserMatch()
    → Crea state.liveMatch
    → Genera lineups inicial
    → Inicializa result (stats, timeline)
    ↓
main.js: render() [re-dibuja UI]
    → matchView.js: renderLiveMatch()
    → Inserta div#match-visualizer-container
    ↓
main.js: setTimeout(..., 50ms)
    → matchVisualController.initMatch()
    ↓
MatchVisualController.initMatch()
    → new MatchVisualizer(container)
    → visualizer.init()
      → Scene + Camera + Renderer
      → Iluminación
      → Geometría cancha
    → visualizer.createBall()
    → Posicionar jugadores en formación
    → visualizer.startRendering() [loop infinito]
    ↓
renderLoop: requestAnimationFrame()
    → renderer.render(scene, camera) ✓
    → 60 FPS (idealmente)
```

---

## 6. PRÓXIMOS PASOS INMEDIATOS

### 6.1 Debuggeando Inicialización (Ahora)

```javascript
// En MatchVisualController.initMatch(), agregar logs:
console.log("Initializing visualizer...");
console.log("Home squad:", homeLineup.length);
console.log("Away squad:", awayLineup.length);
console.log("Container size:", 
  container.clientWidth, "x", container.clientHeight);

// En MatchVisualizer.init():
console.log("Scene created:", this.scene);
console.log("Renderer size:", this.renderer.getSize());
```

### 6.2 Integración con Eventos de Partido (Próxima)

**Hook en advanceLiveUserMatch()** (gameEngine.js):

```javascript
while (liveMatch.minute < targetMinute) {
  // Existing logic...
  const eventsBefore = liveMatch.result.timeline.length;
  FMG.addLiveMinuteEvent(liveMatch, state, liveMatch.minute);
  const eventsAfter = liveMatch.result.timeline.length;
  
  // NUEVO: Sincronizar con visualizador
  if (eventsAfter > eventsBefore) {
    const newEvent = liveMatch.result.timeline[eventsAfter - 1];
    FMG.matchVisualController.queueEvent("action", {
      type: newEvent.type,
      minute: newEvent.minute,
      player: newEvent.playerName,
      detail: newEvent.text
    });
  }
  
  liveMatch.minute++;
}
```

### 6.3 Sistema de Posiciones en Tiempo Real

**Almacenar en matchState:**
```javascript
FMG.matchVisualController.visualizer.matchState.playerPositions = {
  [playerId]: {
    x: coordX,      // -52.5 a +52.5 (ancho cancha)
    y: 0,           // Siempre en piso
    z: coordZ,      // -34 a +34 (largo cancha)
    teamId,
    isHome,
    ballDistance,   // Para calcular quién toca
    velocityX,      // Para movimiento anticipado
    velocityZ
  }
}
```

---

## 7. TESTING

### 7.1 Checklist de Validación

- [ ] Página carga sin errores Three.js
- [ ] Contenedor #match-visualizer-container visible
- [ ] Canvas aparece dentro del contenedor
- [ ] Cancha visible (verde)
- [ ] 22 jugadores visibles (11 + 11)
- [ ] Balón blanco en centro
- [ ] Camera broadcast correcta (vista lateral)
- [ ] FPS constante en consola: 60
- [ ] Controles de partido funcionan (avanzar minutos)
- [ ] Animaciones sincronizadas con events

### 7.2 Performance Profiling

```javascript
// En navegador DevTools:
1. Performance tab → Record
2. Jugar partido 5 minutos
3. Revisar:
   - Render time < 16.67ms (para 60 FPS)
   - GPU memory < 500MB
   - No memory leaks en WebGL
```

---

## 8. REFERENCIAS Y DOCUMENTACIÓN

**Three.js:**
- https://threejs.org/docs/
- https://threejs.org/examples/

**Performance WebGL:**
- https://www.khronos.org/webgl/wiki/Optimization_Tips
- https://developer.mozilla.org/es/docs/Web/API/WebGL_API

**Nuestro proyecto:**
- Fase 13: Sistema de partidos en vivo (simulación)
- gameEngine.js: Lógica de partido minuto a minuto
- matchEngine.js: Simulación de eventos (pase, tiro, gol)

---

## 9. NOTAS IMPORTANTES

### Decisiones de Diseño

1. **Three.js sobre Godot:** 
   - Godot sería cambio arquitectónico grande
   - Three.js permite iteración rápida
   - Futura migración posible si visual demand crece

2. **Cápsulas en lugar de modelos:**
   - 4-segment geometry es suficiente
   - No necesitamos rigging/animación
   - Bajo overhead de GPU

3. **Cola de eventos:**
   - Evita race conditions
   - Permite sincronización temporal
   - Extensible para replay/slow-mo

4. **Sin HUD superpuesto 3D:**
   - Mantener información en DOM
   - CSS + Canvas = mejor separación
   - Permite iteración independiente

### Limitaciones Conocidas

- No hay rotación de jugadores (siempre miran hacia cancha)
- Balón no tiene rotación física
- Celebraciones gol serán básicas (jump)
- No hay deformación de cancha por pisadas
- Sin audio

### Escalabilidad Futura

```
Fase 14.1 (Actual)  → Visualizador básico + animaciones simples
Fase 14.2          → Eventos sincronizados + posiciones dinámicas
Fase 14.3          → Optimización GPU + LOD
Fase 14.4          → Calidad visual (sombreadores, efectos)
Fase 15 (Futuro)   → Migración a Godot 4 (si se justifica)
```

---

## 10. COMANDOS ÚTILES

```bash
# Iniciar servidor
cd football-manager-game
python -m http.server 8000

# Testing rápido
curl http://localhost:8000/src/matchVisualizer.js | head -20

# Ver logs en VS Code terminal
npm run test  # Si se agregan tests

# Profiler en navegador
# F12 → Performance → Grabar → Play partido → Parar
```

---

**Fecha:** 6 de mayo de 2026
**Estado:** Fase 14 - Etapa inicial completada ✅
**Próxima Revisión:** Después de integrar eventos de partido
