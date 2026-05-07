(function () {
  const FMG = (window.FMG = window.FMG || {});

  // =============================================================================
  // MATCH VISUALIZER - MOTOR VISUAL 3D OPTIMIZADO PARA 60 FPS
  // =============================================================================
  // Arquitectura:
  // - Cancha 3D procedural simple
  // - Jugadores como cápsulas estilizadas con colores de equipo
  // - Balón visible
  // - Cámara broadcast lateral
  // - Animación fluida de movimiento y acciones
  // - Culling y LOD para optimizar

  class MatchVisualizer {
    constructor(containerElement) {
      this.container = containerElement;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.field = null;
      this.players = {}; // playerInstanceId -> { mesh, visualId }
      this.ball = null;
      this.hud = null;
      this.lastFrameTime = performance.now();
      this.deltaTime = 0;
      this.animationFrameId = null;
      this.isRunning = false;
      this.config = {
        fieldWidth: 105,
        fieldHeight: 68,
        playerHeight: 1.8,
        playerRadius: 0.25,
        ballRadius: 0.22,
        targetFPS: 60,
        targetFrameTime: 1000 / 60 // ~16.67ms
      };
      this.matchState = {
        homeTeamId: null,
        awayTeamId: null,
        homeGoals: 0,
        awayGoals: 0,
        minute: 0,
        possession: 50,
        ballPos: { x: 0, y: 0.22, z: 0 },
        playerPositions: {} // playerId -> { x, y, z, teamId, isHome }
      };
    }

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================

    init() {
      if (this.scene) return; // Ya inicializado

      // Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a3a1a); // Verde oscuro de noche

      // Camera: broadcast lateral, altura ojo
      this.camera = new THREE.PerspectiveCamera(
        55,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        500
      );
      this.camera.position.set(0, 24, 60); // Lado derecho, altura moderada
      this.camera.lookAt(0, 8, 0); // Mira hacia el centro de la cancha

      // Renderer: compatible, sin Forward+ pesado
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        logarithmicDepthBuffer: false,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(
        this.container.clientWidth,
        this.container.clientHeight
      );
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limitar ratio para FPS
      this.renderer.shadowMap.enabled = false; // Sin sombras para performance
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.container.appendChild(this.renderer.domElement);

      // Iluminación simple
      this.setupLighting();

      // Geometría
      this.createField();
      this.createSkybox();

      // HUD
      this.createHUD();

      // Event listeners
      this._resizeHandler = () => this.onWindowResize();
      window.addEventListener("resize", this._resizeHandler);

      // Iniciar renderizado
      this.startRendering();
    }

    setupLighting() {
      // Luz ambiental
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      this.scene.add(ambientLight);

      // Luz direccional (sol/estadio)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
      directionalLight.position.set(60, 80, 40);
      directionalLight.castShadow = false;
      this.scene.add(directionalLight);

      // Luz de relleno suave
      const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
      fillLight.position.set(-60, 30, -40);
      this.scene.add(fillLight);
    }

    createField() {
      const { fieldWidth, fieldHeight } = this.config;

      // Pasto
      const grassGeometry = new THREE.PlaneGeometry(fieldWidth, fieldHeight);
      const grassMaterial = new THREE.MeshLambertMaterial({
        color: 0x2f6f42
      });
      const grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
      grassMesh.rotation.x = -Math.PI / 2;
      grassMesh.receiveShadow = false;
      this.scene.add(grassMesh);

      // Franjas sutiles para evitar look plastico plano.
      const stripeWidth = fieldWidth / 10;
      for (let i = 0; i < 10; i += 1) {
        const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, fieldHeight);
        const stripeMaterial = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x255f38 : 0x347a48,
          transparent: true,
          opacity: 0.34,
          depthWrite: false
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(-fieldWidth / 2 + stripeWidth * i + stripeWidth / 2, 0.012, 0);
        this.scene.add(stripe);
      }

      // Líneas de cancha
      this.drawFieldLines();

      // Bordes
      this.drawFieldBorders();

      this.field = grassMesh;
    }

    drawFieldLines() {
      const { fieldWidth, fieldHeight } = this.config;
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2
      });

      // Linea media: divide ambos campos por la mitad en el eje X.
      const midGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.01, -fieldHeight / 2),
        new THREE.Vector3(0, 0.01, fieldHeight / 2)
      ]);
      this.scene.add(new THREE.Line(midGeometry, lineMaterial));

      // Líneas de meta
      const topGoalGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-fieldWidth / 2, 0.01, fieldHeight / 2),
        new THREE.Vector3(fieldWidth / 2, 0.01, fieldHeight / 2)
      ]);
      const bottomGoalGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-fieldWidth / 2, 0.01, -fieldHeight / 2),
        new THREE.Vector3(fieldWidth / 2, 0.01, -fieldHeight / 2)
      ]);
      this.scene.add(new THREE.Line(topGoalGeometry, lineMaterial));
      this.scene.add(new THREE.Line(bottomGoalGeometry, lineMaterial));

      // Área de gol simplificada (rectángulos)
      const penaltyWidth = 40;
      const penaltyDepth = 16.5;
      this.drawPenaltyBox(penaltyWidth, penaltyDepth, fieldHeight, lineMaterial);
    }

    drawPenaltyBox(width, depth, fieldHeight, lineMaterial) {
      const halfWidth = width / 2;
      const y = fieldHeight / 2;

      // Área superior
      const topBoxPoints = [
        new THREE.Vector3(-halfWidth, 0.01, y),
        new THREE.Vector3(halfWidth, 0.01, y),
        new THREE.Vector3(halfWidth, 0.01, y - depth),
        new THREE.Vector3(-halfWidth, 0.01, y - depth),
        new THREE.Vector3(-halfWidth, 0.01, y)
      ];
      const topBoxGeometry = new THREE.BufferGeometry().setFromPoints(
        topBoxPoints
      );
      this.scene.add(new THREE.Line(topBoxGeometry, lineMaterial));

      // Área inferior
      const bottomBoxPoints = [
        new THREE.Vector3(-halfWidth, 0.01, -y),
        new THREE.Vector3(halfWidth, 0.01, -y),
        new THREE.Vector3(halfWidth, 0.01, -y + depth),
        new THREE.Vector3(-halfWidth, 0.01, -y + depth),
        new THREE.Vector3(-halfWidth, 0.01, -y)
      ];
      const bottomBoxGeometry = new THREE.BufferGeometry().setFromPoints(
        bottomBoxPoints
      );
      this.scene.add(new THREE.Line(bottomBoxGeometry, lineMaterial));
    }

    drawFieldBorders() {
      const { fieldWidth, fieldHeight } = this.config;
      const borderMaterial = new THREE.LineBasicMaterial({
        color: 0xcccccc,
        linewidth: 1
      });

      const borderGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-fieldWidth / 2, 0.01, fieldHeight / 2),
        new THREE.Vector3(fieldWidth / 2, 0.01, fieldHeight / 2),
        new THREE.Vector3(fieldWidth / 2, 0.01, -fieldHeight / 2),
        new THREE.Vector3(-fieldWidth / 2, 0.01, -fieldHeight / 2),
        new THREE.Vector3(-fieldWidth / 2, 0.01, fieldHeight / 2)
      ]);
      this.scene.add(new THREE.Line(borderGeometry, borderMaterial));
    }

    createSkybox() {
      const skyGeometry = new THREE.SphereGeometry(300, 6, 6);
      const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
      });
      this.scene.add(new THREE.Mesh(skyGeometry, skyMaterial));
    }

    createHUD() {
      // Se renderiza sobre canvas con 2D context
      this.hud = {
        time: 0,
        fps: 60,
        stats: {}
      };
    }

    // =========================================================================
    // ACTUALIZACIÓN DE ESTADO Y ANIMACIÓN
    // =========================================================================

    updateMatchState(minute, homeGoals, awayGoals, possession = 50) {
      this.matchState.minute = minute;
      this.matchState.homeGoals = homeGoals;
      this.matchState.awayGoals = awayGoals;
      this.matchState.possession = possession;
    }

    setTeamInfo(homeTeamId, homeTeamColor, awayTeamId, awayTeamColor) {
      this.matchState.homeTeamId = homeTeamId;
      this.matchState.homeTeamColor = homeTeamColor || 0xff0000;
      this.matchState.awayTeamId = awayTeamId;
      this.matchState.awayTeamColor = awayTeamColor || 0x0000ff;
    }

    addPlayer(playerId, startPos, isHome) {
      if (this.players[playerId]) return; // Ya existe

      const capsuleGeometry = new THREE.CapsuleGeometry(
        this.config.playerRadius,
        this.config.playerHeight - this.config.playerRadius * 2,
        4,
        4
      );
      const color = isHome
        ? this.matchState.homeTeamColor
        : this.matchState.awayTeamColor;
      const playerMaterial = new THREE.MeshPhongMaterial({ color });
      const playerMesh = new THREE.Mesh(capsuleGeometry, playerMaterial);

      playerMesh.position.set(startPos.x, startPos.y, startPos.z);
      playerMesh.castShadow = false;
      playerMesh.receiveShadow = false;

      // Número visual (pequeño sprite)
      const numberMesh = this.createPlayerNumber(isHome);
      playerMesh.add(numberMesh);

      this.scene.add(playerMesh);
      this.players[playerId] = {
        mesh: playerMesh,
        visualId: playerId,
        isHome
      };

      this.matchState.playerPositions[playerId] = {
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
        teamId: isHome ? this.matchState.homeTeamId : this.matchState.awayTeamId,
        isHome
      };
    }

    createPlayerNumber(isHome) {
      const numberGeometry = new THREE.SphereGeometry(0.08, 4, 4);
      const numberMaterial = new THREE.MeshBasicMaterial({
        color: isHome ? 0xffffff : 0x000000
      });
      const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
      numberMesh.position.y = this.config.playerHeight / 2;
      return numberMesh;
    }

    createBall() {
      const ballGeometry = new THREE.SphereGeometry(
        this.config.ballRadius,
        8,
        8
      );
      const ballMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 100
      });
      this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
      this.ball.position.copy(
        new THREE.Vector3(
          this.matchState.ballPos.x,
          this.matchState.ballPos.y,
          this.matchState.ballPos.z
        )
      );
      this.scene.add(this.ball);
    }

    animatePlayerMove(playerId, targetPos, duration = 1000) {
      const player = this.players[playerId];
      if (!player) return;

      const startX = player.mesh.position.x;
      const startY = player.mesh.position.y;
      const startZ = player.mesh.position.z;
      const startTime = performance.now();
      const _target = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);

      const animate = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        player.mesh.position.x = startX + (targetPos.x - startX) * t;
        player.mesh.position.y = startY + (targetPos.y - startY) * t;
        player.mesh.position.z = startZ + (targetPos.z - startZ) * t;

        const pos = this.matchState.playerPositions[playerId];
        if (pos) {
          pos.x = player.mesh.position.x;
          pos.y = player.mesh.position.y;
          pos.z = player.mesh.position.z;
        }

        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }

    animateBallMove(targetPos, duration = 1000, arcHeight = 2) {
      if (!this.ball) return Promise.resolve();

      return new Promise((resolve) => {
        const startX = this.ball.position.x;
        const startY = this.ball.position.y;
        const startZ = this.ball.position.z;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const progress = Math.min((currentTime - startTime) / duration, 1);
          const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

          this.ball.position.x = startX + (targetPos.x - startX) * t;
          this.ball.position.y = startY + (targetPos.y - startY) * t + arcHeight * Math.sin(progress * Math.PI);
          this.ball.position.z = startZ + (targetPos.z - startZ) * t;

          this.matchState.ballPos.x = this.ball.position.x;
          this.matchState.ballPos.y = this.ball.position.y;
          this.matchState.ballPos.z = this.ball.position.z;

          if (progress < 1) requestAnimationFrame(animate);
          else resolve();
        };

        requestAnimationFrame(animate);
      });
    }

    animateShot(targetPos, duration = 400) {
      if (!this.ball) return;

      const startX = this.ball.position.x;
      const startY = this.ball.position.y;
      const startZ = this.ball.position.z;
      const startTime = performance.now();

      const animate = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const t = progress * progress;

        this.ball.position.x = startX + (targetPos.x - startX) * t;
        this.ball.position.y = startY + (targetPos.y - startY) * t;
        this.ball.position.z = startZ + (targetPos.z - startZ) * t;

        this.matchState.ballPos.x = this.ball.position.x;
        this.matchState.ballPos.y = this.ball.position.y;
        this.matchState.ballPos.z = this.ball.position.z;

        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }

    // =========================================================================
    // RENDERIZADO Y FPS
    // =========================================================================

    startRendering() {
      this.isRunning = true;
      const render = () => {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame(render);

        // Cálculo delta time para consistency
        const now = performance.now();
        this.deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Update HUD
        this.hud.fps = Math.round(1000 / this.deltaTime);
        this.hud.time = this.matchState.minute;

        // Renderizar
        this.renderer.render(this.scene, this.camera);

        // Draw HUD overlay
        this.renderHUDOverlay();
      };

      this.animationFrameId = requestAnimationFrame(render);
    }

    renderHUDOverlay() {
      // Información en el DOM (se puede mejorar con canvas 2D)
      // Por ahora usando CSS y HTML en matchView
    }

    stopRendering() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    }

    onWindowResize() {
      if (!this.renderer) return;

      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    // =========================================================================
    // LIMPIAR
    // =========================================================================

    dispose() {
      this.stopRendering();
      if (this._resizeHandler) {
        window.removeEventListener("resize", this._resizeHandler);
        this._resizeHandler = null;
      }

      // Limpiar geometrías y materiales
      this.scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.field = null;
      this.ball = null;
      this.players = {};
    }
  }

  // =============================================================================
  // EXPORTAR
  // =============================================================================

  FMG.MatchVisualizer = MatchVisualizer;
})();
