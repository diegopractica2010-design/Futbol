(function () {
  "use strict";

  // ============================================================
  // FASE 18 — index.js
  // Reemplaza AISystem de Fase 16 con dos TeamBrains.
  // Aplica IA a: equipo rival (completo) + equipo usuario (no controlados).
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase18 = window.FMG.Phase18 || {};

  // Usuario ataca hacia la derecha (x creciente), IA hacia la izquierda
  var USER_ATTACKS_RIGHT = true;
  var AI_ATTACKS_RIGHT   = false;

  function MatchAI() {
    this._userBrain = null;
    this._aiBrain   = null;
    this._tick      = 0;
  }

  MatchAI.prototype.init = function () {
    var TB = window.FMG.Phase18.TeamBrain;
    this._userBrain = new TB(0, USER_ATTACKS_RIGHT);
    this._aiBrain   = new TB(1, AI_ATTACKS_RIGHT);
    this._userBrain.init();
    this._aiBrain.init();
  };

  MatchAI.prototype.tick = function (match, ball) {
    if (!this._userBrain) this.init();
    this._tick++;

    // Equipo IA: todos los jugadores
    match.aiTeam.forEach(function (p, index) { p._teamIndex = index; });
    this._aiBrain.tick(
      match.aiTeam,
      match.userTeam,
      ball,
      match,
      this._tick
    );

    // Equipo usuario: solo los NO controlados
    var controlled = match.controlled;
    match.userTeam.forEach(function (p, index) { p._teamIndex = index; });
    var nonControlled = match.userTeam.filter(function (p) {
      return p !== controlled;
    });

    if (nonControlled.length > 0) {
      this._userBrain.tick(
        nonControlled,
        match.aiTeam,
        ball,
        match,
        this._tick
      );
    }
  };

  MatchAI.prototype.reset = function () {
    this._tick = 0;
    if (this._userBrain) this._userBrain.reset();
    if (this._aiBrain)   this._aiBrain.reset();
  };

  // ---- Fabrica: crea Phase17Game con IA de Fase 18 inyectada ----

  window.FMG.Phase18.createGame = function (canvas) {
    // Crear juego con animaciones (Fase 17)
    var game = window.FMG.Phase17.createGame(canvas);

    // Crear IA de Fase 18
    var matchAI = new MatchAI();
    matchAI.init();
    game.matchAI = matchAI;

    // Reemplazar el AISystem de Fase 16 con el MatchAI de Fase 18
    // Parchear _logicTick para usar el nuevo sistema
    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var match = game.match;
      var ball  = game.ball;

      if (!match.running || match.paused) return;

      // 1. Input usuario
      match.updateControlled(ball.ball.x, ball.ball.y);
      game._applyInput();

      // 2. IA Fase 18 (reemplaza game.ai.tick)
      matchAI.tick(match, ball);

      // 3. Colisiones
      match.allPlayers().forEach(function (p) { ball.resolvePlayerCollision(p); });

      // 4. Fisica del balon
      var goalEvent = ball.tick();

      // 5. Gol
      if (goalEvent) {
        var team = goalEvent === "goal-left" ? 0 : 1;
        match.registerGoal(goalEvent);
        game.anim.triggerGoal(team);
        game.audio.playGoal();
        ball.reset();
        match.kickoff();
        matchAI.reset();
      }

      // 6. Animaciones
      game.anim.tick();
      if (game.animMgr) game.animMgr.tick(match, ball);

      // 7. Tiempo
      match.advanceTick();
      if (match.finished) game.audio.playWhistle();
    };

    // Parchear reset
    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      matchAI.reset();
    };

    return game;
  };
})();
