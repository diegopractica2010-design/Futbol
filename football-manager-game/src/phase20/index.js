(function () {
  "use strict";

  // ============================================================
  // FASE 20 — index.js
  // Inyecta camara broadcast, replay y HUD televisivo en Phase19Game.
  // Parchea el render loop:
  //   1. beginWorldTransform()  <- camara
  //   2. dibujar cancha + jugadores + balon
  //   3. endWorldTransform()
  //   4. dibujar HUD en coordenadas de pantalla
  // No modifica ningun archivo anterior.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var C = null;

  window.FMG.Phase20.createGame = function (canvas) {
    C = window.FMG.Phase16.C;

    var game = window.FMG.Phase19.createGame(canvas);
    var ctx  = canvas.getContext("2d");

    // ---- Sistemas de Fase 20 ----
    var camCtrl    = new window.FMG.Phase20.CameraController(canvas);
    var replayBuf  = new window.FMG.Phase20.ReplayBuffer();
    var replayPlay = new window.FMG.Phase20.ReplayPlayer();
    var broadHUD   = new window.FMG.Phase20.BroadcastHUD();

    game.camCtrl   = camCtrl;
    game.replayBuf = replayBuf;
    game.replayPlay = replayPlay;
    game.broadHUD = broadHUD;

    // Estado de eventos de camara para el tick
    var _camEvents = null;
    // Estado de overlay de gol
    var _goalOverlay = null; // { team, score, timer }

    // ---- Parchear _logicTick para grabar replay y detectar eventos ----
    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      if (!game.match.running || game.match.paused) return;

      // Detectar tiro antes del tick
      var ballSpeedBefore = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      var scoreBefore     = game.match.score.slice();

      origLogic();

      var ballSpeedAfter = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      var b = game.ball.ball;

      // Detectar tiro (impulso fuerte al balon)
      _camEvents = null;
      if (ballSpeedAfter > 6 && ballSpeedAfter > ballSpeedBefore + 3) {
        _camEvents = { shot: true, shotX: b.x, shotY: b.y };
      }

      // Detectar gol
      var scored = game.match.score[0] !== scoreBefore[0] || game.match.score[1] !== scoreBefore[1];
      if (scored) {
        var team = game.match.score[0] > scoreBefore[0] ? 0 : 1;
        var gx   = team === 0 ? C.FIELD_W : 0;
        _camEvents = { goal: true, goalX: gx, goalY: C.FIELD_H / 2, team: team };
        _goalOverlay = { team: team, score: game.match.score.slice(), timer: 120 };

        // Iniciar replay automatico tras 60 ticks
        setTimeout(function () {
          if (!game.match.running) return;
          var frames = replayBuf.getLast(window.FMG.Phase20.ReplayPlayer.REPLAY_FRAMES);
          if (frames.length > 10) {
            camCtrl.setReplayTarget(gx, C.FIELD_H / 2);
            replayPlay.start(frames, function () {
              camCtrl.exitReplay();
            });
          }
        }, 1000);
      }

      // Grabar frame
      replayBuf.record(game.match, game.ball);

      // Actualizar camara
      camCtrl.tick(game.match, game.ball, _camEvents);

      // Actualizar overlay de gol
      if (_goalOverlay) {
        _goalOverlay.timer--;
        if (_goalOverlay.timer <= 0) _goalOverlay = null;
      }
    };

    // ---- Parchear hud.render para aplicar transformacion de camara ----
    var origHudRender = game.hud.render.bind(game.hud);
    game.hud.render = function (match, ball, anim) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var isReplay = replayPlay.active;

      if (isReplay) {
        // ---- MODO REPLAY ----
        var frame = replayPlay.tick();
        if (frame) {
          // Aplicar transformacion de camara
          camCtrl.beginWorldTransform();

          // Dibujar cancha
          game.hud._drawField();

          // Dibujar jugadores desde el frame (posiciones interpoladas)
          var allPlayers = frame.a.concat(frame.u);
          allPlayers.forEach(function (fp) {
            // Buscar el jugador real para obtener team
            var real = match.allPlayers().find(function (p) { return p.id === fp.id; });
            if (real) {
              var fakePl = { x: fp.x, y: fp.y, team: real.team };
              game.hud._drawPlayer(fakePl, false);
            }
          });

          // Dibujar balon del frame
          var fakeBall = { x: frame.bx, y: frame.by };
          game.hud._drawBall(fakeBall);

          camCtrl.endWorldTransform();

          // HUD de replay (coordenadas de pantalla)
          var progress = replayPlay._cursor / (replayPlay._frames.length - 1);
          broadHUD.drawReplayOverlay(ctx, Math.min(progress, 1));
          broadHUD.drawScoreboard(ctx, { score: frame.score, secondsLeft: function () { return 0; } }, "replay");
        }
        return;
      }

      // ---- MODO NORMAL ----

      // Aplicar transformacion de camara al mundo
      camCtrl.beginWorldTransform();

      // Dibujar cancha
      game.hud._drawField();

      // Dibujar jugadores y balon con animaciones (Fase 17-19)
      if (game.animMgr) {
        game.animMgr.render(ctx, match, ball);
      } else {
        match.aiTeam.forEach(function (p)   { game.hud._drawPlayer(p, false); });
        match.userTeam.forEach(function (p) { game.hud._drawPlayer(p, p === match.controlled); });
        game.hud._drawBall(ball.ball);
      }

      camCtrl.endWorldTransform();

      // ---- HUD en coordenadas de pantalla (no afectado por camara) ----
      broadHUD.drawScoreboard(ctx, match, camCtrl.state.mode);
      broadHUD.drawControls(ctx);

      // Overlay de gol
      if (_goalOverlay && _goalOverlay.timer > 60) {
        broadHUD.drawGoalOverlay(ctx, _goalOverlay.team, _goalOverlay.score);
      }

      // Flash de gol (AnimationSystem)
      if (anim && anim.isGoalFlashing()) game.hud._drawGoalFlash(anim);

      // Overlays de estado
      if (match.finished)    broadHUD.drawFinalOverlay(ctx, match);
      else if (match.paused) broadHUD.drawPause(ctx);
    };

    // ---- Parchear reset ----
    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      replayBuf.reset();
      replayPlay.active = false;
      _goalOverlay = null;
      _camEvents   = null;
      camCtrl.exitReplay();
    };

    return game;
  };
})();
