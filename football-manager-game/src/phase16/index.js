(function () {
  "use strict";

  // ============================================================
  // FASE 16 — index.js (Orquestador)
  // Unico archivo que conoce todos los sistemas.
  // Conecta: Input -> Match -> Ball -> AI -> Anim -> HUD -> Audio
  // Expone API publica: init, start, reset, dispose
  // ============================================================

  const P16 = window.FMG.Phase16;
  const C   = P16.C;

  function Phase16Game(canvas) {
    this._canvas = canvas;
    this._ctx    = canvas.getContext("2d");
    this._rafId  = null;
    this._last   = 0;
    this._TICK   = 1000 / C.FPS;

    // Instanciar sistemas
    this.input  = new P16.InputSystem();
    this.match  = new P16.MatchSystem();
    this.ball   = new P16.BallSystem();
    this.ai     = new P16.AISystem();
    this.anim   = new P16.AnimationSystem();
    this.camera = new P16.CameraSystem(canvas);
    this.hud    = new P16.HUDSystem(this._ctx);
    this.audio  = new P16.AudioSystem();

    this._resizeHandler = () => this.camera.onResize();
    window.addEventListener("resize", this._resizeHandler);
  }

  // ---- Tick de logica ----

  Phase16Game.prototype._logicTick = function () {
    const match = this.match;
    const ball  = this.ball;

    if (!match.running || match.paused) return;

    // 1. Input -> mover jugador controlado
    match.updateControlled(ball.ball.x, ball.ball.y);
    this._applyInput();

    // 2. IA
    this.ai.tick(match, ball);

    // 3. Colisiones jugador-balon
    match.allPlayers().forEach((p) => ball.resolvePlayerCollision(p));

    // 4. Fisica del balon
    const goalEvent = ball.tick();

    // 5. Gol
    if (goalEvent) {
      const team = goalEvent === "goal-left" ? 0 : 1;
      match.registerGoal(goalEvent);
      this.anim.triggerGoal(team);
      this.audio.playGoal();
      ball.reset();
      match.kickoff();
    }

    // 6. Animaciones
    this.anim.tick();

    // 7. Tiempo
    match.advanceTick();

    if (match.finished) this.audio.playWhistle();
  };

  Phase16Game.prototype._applyInput = function () {
    const p = this.match.controlled;
    if (!p) return;

    // Pausa
    if (this.input.isPause()) {
      this.match.paused = !this.match.paused;
      this.input.consume("p"); this.input.consume("P");
      return;
    }

    // Reinicio
    if (this.input.isRestart() && this.match.finished) {
      this.reset();
      this.start();
      return;
    }

    if (this.match.paused) return;

    // Movimiento
    let dx = 0, dy = 0;
    if (this.input.isDirLeft())  dx -= 1;
    if (this.input.isDirRight()) dx += 1;
    if (this.input.isDirUp())    dy -= 1;
    if (this.input.isDirDown())  dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      this.match.movePlayer(p, dx / len, dy / len, C.PLAYER_SPEED);
    }

    // Pase
    if (this.input.isPass()) {
      this.input.consume("z"); this.input.consume("j");
      const target = this._nearestTeammate(p);
      if (target) {
        const dx2 = target.x - this.ball.ball.x;
        const dy2 = target.y - this.ball.ball.y;
        const len = Math.hypot(dx2, dy2) || 1;
        this.ball.applyImpulse((dx2 / len) * C.PASS_POWER, (dy2 / len) * C.PASS_POWER);
        this.audio.playKick();
      }
    }

    // Tiro
    if (this.input.isShoot()) {
      this.input.consume("x"); this.input.consume("k");
      const gx = C.FIELD_W - this.ball.ball.x;
      const gy = C.FIELD_H / 2 - this.ball.ball.y;
      const len = Math.hypot(gx, gy) || 1;
      this.ball.applyImpulse((gx / len) * C.SHOOT_POWER, (gy / len) * C.SHOOT_POWER);
      this.audio.playKick();
    }
  };

  Phase16Game.prototype._nearestTeammate = function (player) {
    let best = null, bestD = Infinity;
    this.match.userTeam.forEach((p) => {
      if (p === player) return;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  };

  // ---- Loop RAF ----

  Phase16Game.prototype._loop = function (ts) {
    this._rafId = requestAnimationFrame((t) => this._loop(t));
    if (ts - this._last >= this._TICK) {
      this._last = ts;
      this._logicTick();
      this.hud.render(this.match, this.ball, this.anim);
    }
  };

  // ---- API publica ----

  Phase16Game.prototype.start = function () {
    this.match.start();
    if (!this._rafId) {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }
  };

  Phase16Game.prototype.reset = function () {
    this.match.reset();
    this.ball.reset();
    this.anim.goalFlash = 0;
  };

  Phase16Game.prototype.dispose = function () {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this.input.unbind();
    window.removeEventListener("resize", this._resizeHandler);
  };

  // Fabrica global
  P16.create = function (canvas) {
    return new Phase16Game(canvas);
  };
})();
