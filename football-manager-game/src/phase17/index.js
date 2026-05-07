(function () {
  "use strict";

  // ============================================================
  // FASE 17 — index.js (Orquestador de animaciones)
  // Extiende Phase16Game inyectando el sistema de animaciones.
  // No modifica ningun archivo de Fase 16.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var P16 = null;
  var P17 = null;

  // ---- AnimationManager: gestiona estados por jugador ----

  function AnimationManager() {
    this._states    = {};  // playerId -> PlayerState
    this._blendTree = null;
    this._playerRen = null;
    this._ballRen   = null;
    this._effects   = null;
  }

  AnimationManager.prototype.init = function () {
    P17 = window.FMG.Phase17;
    this._blendTree = new P17.BlendTree();
    this._playerRen = new P17.PlayerRenderer();
    this._ballRen   = new P17.BallRenderer();
    this._effects   = new P17.EffectsSystem();
  };

  // Obtener o crear PlayerState para un jugador
  AnimationManager.prototype._getState = function (player) {
    if (!this._states[player.id]) {
      var ps = new P17.PlayerState(player.id);
      ps.x    = player.x;
      ps.y    = player.y;
      ps.prevX = player.x;
      ps.prevY = player.y;
      ps.team  = player.team;
      this._states[player.id] = ps;
    }
    return this._states[player.id];
  };

  // Actualizar todos los estados de animacion
  AnimationManager.prototype.tick = function (match, ball) {
    var self = this;
    var ballX = ball.ball.x;
    var ballY = ball.ball.y;

    match.allPlayers().forEach(function (player) {
      var ps = self._getState(player);
      var hasBall = Math.hypot(player.x - ballX, player.y - ballY) < 20;
      ps.update(player, hasBall);

      // Polvo al correr
      if (ps.speed > 1.5) {
        self._effects.spawnDust(player.x, player.y, ps.speed);
      }
    });

    this._ballRen.update(ball.ball);
    this._effects.tick();
  };

  // Notificar accion forzada (llamado desde el orquestador del juego)
  AnimationManager.prototype.notifyAction = function (playerId, action) {
    var dur = P17.BlendTree.ACTION_DURATION[action];
    if (!dur) return;
    var ps = this._states[playerId];
    if (ps) ps.forceAction(action, dur);
  };

  // Notificar gol (efectos en posicion del arco)
  AnimationManager.prototype.notifyGoal = function (x, y, scoringTeam, match) {
    this._effects.triggerGoalRing(x, y);
    // Celebracion de todos los jugadores del equipo que marcó
    var self = this;
    var team = scoringTeam === "goal-left" ? 0 : 1;
    match.allPlayers().forEach(function (p) {
      if (p.team === team) {
        var ps = self._states[p.id];
        if (ps) ps.forceAction(P17.ACTIONS.CELEBRATE, P17.BlendTree.ACTION_DURATION.celebrate);
      }
    });
  };

  // Notificar chispas de patada
  AnimationManager.prototype.notifyKick = function (x, y, power) {
    this._effects.spawnKickSparks(x, y, power);
  };

  // Render completo de jugadores + balon + efectos
  AnimationManager.prototype.render = function (ctx, match, ball) {
    var self = this;

    // Efectos debajo de jugadores
    this._effects.draw(ctx);

    // Jugadores (IA primero, usuario encima)
    match.aiTeam.forEach(function (p) {
      var ps   = self._getState(p);
      var pose = self._blendTree.evaluate(ps);
      self._playerRen.draw(ctx, ps, pose, false);
    });
    match.userTeam.forEach(function (p) {
      var ps   = self._getState(p);
      var pose = self._blendTree.evaluate(ps);
      self._playerRen.draw(ctx, ps, pose, p === match.controlled);
    });

    // Balon
    this._ballRen.draw(ctx, ball.ball);
  };

  AnimationManager.prototype.reset = function () {
    this._states = {};
    this._ballRen = new P17.BallRenderer();
    this._effects = new P17.EffectsSystem();
  };

  // ---- Fabrica: crea un Phase16Game con animaciones inyectadas ----

  window.FMG.Phase17.createGame = function (canvas) {
    P16 = window.FMG.Phase16;
    P17 = window.FMG.Phase17;

    var game = P16.create(canvas);
    var animMgr = new AnimationManager();
    animMgr.init();

    // Guardar referencia
    game.animMgr = animMgr;

    // Parchear _logicTick para incluir tick de animaciones
    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      origLogic();
      if (game.match.running && !game.match.paused) {
        animMgr.tick(game.match, game.ball);
      }
    };

    // Parchear _applyInput para notificar acciones
    var origInput = game._applyInput.bind(game);
    game._applyInput = function () {
      var ballBefore = { x: game.ball.ball.x, y: game.ball.ball.y };
      var speedBefore = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      origInput();
      var speedAfter = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      var p = game.match.controlled;
      if (!p) return;

      // Detectar pase o tiro por cambio de velocidad del balon
      if (speedAfter > speedBefore + 2) {
        var action = speedAfter > P16.C.SHOOT_POWER * 0.7 ? P17.ACTIONS.SHOOT : P17.ACTIONS.PASS;
        animMgr.notifyAction(p.id, action);
        animMgr.notifyKick(ballBefore.x, ballBefore.y, speedAfter);
      }
    };

    // Parchear logica de gol en _logicTick (ya ejecutado, buscar en ball.tick)
    var origLoop = game._loop.bind(game);
    // Interceptar goalEvent via parcheo de ball.tick
    var origBallTick = game.ball.tick.bind(game.ball);
    game.ball.tick = function () {
      var result = origBallTick();
      if (result) {
        var gx = result === "goal-left" ? P16.C.FIELD_W : 0;
        var gy = P16.C.FIELD_H / 2;
        animMgr.notifyGoal(gx, gy, result, game.match);
      }
      return result;
    };

    // Parchear HUD render para usar PlayerRenderer en lugar del circulo
    var origHudRender = game.hud.render.bind(game.hud);
    game.hud.render = function (match, ball, anim) {
      var ctx = game._ctx;
      var C   = P16.C;

      ctx.clearRect(0, 0, C.FIELD_W, C.FIELD_H);

      // Cancha (reutilizar metodo privado del HUDSystem)
      game.hud._drawField();

      // Jugadores y balon con animaciones
      animMgr.render(ctx, match, ball);

      // HUD superpuesto (marcador, overlays)
      game.hud._drawScorebar(match);
      if (anim.isGoalFlashing())  game.hud._drawGoalFlash(anim);
      if (match.finished)         game.hud._drawFinished(match);
      else if (match.paused)      game.hud._drawPause();
    };

    // Parchear reset para limpiar estados de animacion
    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      animMgr.reset();
    };

    return game;
  };
})();
