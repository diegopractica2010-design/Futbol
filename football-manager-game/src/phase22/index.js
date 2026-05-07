(function () {
  "use strict";

  window.FMG = window.FMG || {};
  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var C = null;

  window.FMG.Phase22.createGame = function (canvas) {
    C = window.FMG.Phase16.C;

    var game = window.FMG.Phase21.createGame(canvas);
    var ctx = canvas.getContext("2d");
    var hudData = new window.FMG.Phase22.HUDData();
    var finalHUD = new window.FMG.Phase22.FinalHUD(canvas.width, canvas.height);
    var lastScore = game.match.score.slice();
    var inputState = { passHeld: false, shootHeld: false, passMode: "short" };

    game.phase22Data = hudData;
    game.finalHUD = finalHUD;

    patchInput(game, finalHUD, hudData, inputState);
    patchLogic(game, hudData, function () { return lastScore; }, function (score) { lastScore = score.slice(); });
    patchRender(game, ctx, hudData, finalHUD);
    patchReset(game, function () {
      var freshData = new window.FMG.Phase22.HUDData();
      Object.keys(hudData).forEach(function (key) { delete hudData[key]; });
      Object.assign(hudData, freshData);
      finalHUD.power.release();
      game.phase22Data = hudData;
      game.finalHUD = finalHUD;
      inputState.passHeld = false;
      inputState.shootHeld = false;
      inputState.passMode = "short";
      lastScore = game.match.score.slice();
      hudData.pushLowerThird("TRANSMISION EN VIVO", "Azul vs Rojo  |  HUD final de partido", "#f0c040", 180);
    });

    hudData.pushLowerThird("TRANSMISION EN VIVO", "Azul vs Rojo  |  HUD final de partido", "#f0c040", 180);
    return game;
  };

  function patchInput(game, finalHUD, hudData, inputState) {
    game._applyInput = function () {
      var p = game.match.controlled;
      if (!p) return;

      if (game.input.isPause()) {
        game.match.paused = !game.match.paused;
        game.input.consume("p");
        game.input.consume("P");
        return;
      }

      if (game.input.isRestart() && game.match.finished) {
        game.reset();
        game.start();
        return;
      }

      if (game.match.paused) return;

      var dx = 0;
      var dy = 0;
      if (game.input.isSwitch()) {
        var dir = game.input.isDown("q") || game.input.isDown("Q") ? -1 : 1;
        p = game.match.selectNextUser(dir);
        game.input.consume("q"); game.input.consume("Q"); game.input.consume("e"); game.input.consume("E");
      }
      if (game.input.isDirLeft()) dx -= 1;
      if (game.input.isDirRight()) dx += 1;
      if (game.input.isDirUp()) dy -= 1;
      if (game.input.isDirDown()) dy += 1;
      if (dx !== 0 || dy !== 0) {
        var len = Math.hypot(dx, dy) || 1;
        var sprint = game.input.isSprint() ? 1.45 : 1;
        game.match.movePlayer(p, dx / len, dy / len, C.PLAYER_SPEED * sprint);
      }

      if (game.input.isTackle()) {
        game.input.consume("c"); game.input.consume("C");
        if (game.animMgr && game.animMgr.notifyAction) game.animMgr.notifyAction(p.id, "tackle");
        if (game.ball.distTo(p) < C.PLAYER_R + C.BALL_R + 18) {
          var tx = C.FIELD_W - game.ball.ball.x;
          var ty = C.FIELD_H / 2 - game.ball.ball.y;
          var tlen = Math.hypot(tx, ty) || 1;
          game.ball.applyImpulse((tx / tlen) * C.PASS_POWER * 0.75, (ty / tlen) * C.PASS_POWER * 0.75, { error: 0.4, spin: 0.8 });
        }
      }

      var passDown = game.input.isPass() || game.input.isLongPass();
      var shootDown = game.input.isShoot();

      if (shootDown) {
        finalHUD.power.charge("shoot");
        hudData.powerType = "shoot";
        inputState.shootHeld = true;
      } else if (inputState.shootHeld) {
        releaseAction(game, finalHUD, hudData, "shoot", p);
        inputState.shootHeld = false;
      }

      if (!shootDown && passDown) {
        finalHUD.power.charge("pass");
        hudData.powerType = "pass";
        inputState.passMode = game.input.isLongPass() ? "long" : "short";
        inputState.passHeld = true;
      } else if (inputState.passHeld && !passDown) {
        releaseAction(game, finalHUD, hudData, "pass", p, inputState.passMode);
        inputState.passHeld = false;
      }

      hudData.powerCharge = finalHUD.power.getValue();
      hudData.powerActive = finalHUD.power.isActive();
    };
  }

  function releaseAction(game, finalHUD, hudData, type, player, passMode) {
    var charge = finalHUD.power.release();
    var power = 0.45 + charge * 0.75;
    hudData.powerCharge = 0;
    hudData.powerActive = false;
    hudData.powerType = type;

    if (type === "pass") {
      var target = nearestTeammate(game.match, player);
      if (!target) return;
      var pdx = target.x - game.ball.ball.x;
      var pdy = target.y - game.ball.ball.y;
      var plen = Math.hypot(pdx, pdy) || 1;
      var isLong = passMode === "long";
      var passPower = C.PASS_POWER * power * (isLong ? 1.45 : 1);
      game.ball.applyImpulse((pdx / plen) * passPower, (pdy / plen) * passPower, {
        targetX: target.x,
        targetY: target.y,
        assist: isLong ? 0.008 : 0.018,
        lift: isLong ? 5.2 : 0.8,
        error: isLong ? 0.7 : 0.25,
        spin: isLong ? 1.2 : 0.55
      });
      notifyKick(game, player, "pass", passPower);
      hudData.pushLowerThird(isLong ? "PASE LARGO" : "PASE FILTRADO", playerLabel(player.id) + "  " + Math.round(power * 100) + "%", "#4a9eff", 120);
    }

    if (type === "shoot") {
      var gx = C.FIELD_W - game.ball.ball.x;
      var gy = C.FIELD_H / 2 - game.ball.ball.y;
      var glen = Math.hypot(gx, gy) || 1;
      game.ball.applyImpulse((gx / glen) * C.SHOOT_POWER * power, (gy / glen) * C.SHOOT_POWER * power, { lift: 2.4, error: 0.55, spin: 1.6 });
      notifyKick(game, player, "shoot", C.SHOOT_POWER * power);
      hudData.stats.registerShot(0, Math.abs(game.ball.ball.y - C.FIELD_H / 2) < C.GOAL_H * 0.55);
      hudData.pushLowerThird("REMATE AZUL", playerLabel(player.id) + "  " + Math.round(power * 100) + "% de potencia", "#ff4a4a", 150);
    }

    if (game.audio) game.audio.playKick();
  }

  function patchLogic(game, hudData, getLastScore, setLastScore) {
    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var before = getLastScore().slice();
      var ballSpeedBefore = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      origLogic();

      var after = game.match.score.slice();
      if (after[0] !== before[0] || after[1] !== before[1]) {
        var team = after[0] > before[0] ? 0 : 1;
        hudData.pushLowerThird("GOL " + (team === 0 ? "AZUL" : "ROJO"), after[0] + " - " + after[1], "#f0c040", 240);
      }
      setLastScore(after);

      var ballSpeedAfter = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      if (ballSpeedAfter > 6 && ballSpeedAfter > ballSpeedBefore + 3 && game.ball.ball.vx < 0) {
        hudData.stats.registerShot(1, Math.abs(game.ball.ball.y - C.FIELD_H / 2) < C.GOAL_H * 0.55);
      }
    };
  }

  function patchRender(game, ctx, hudData, finalHUD) {
    game.hud.render = function (match, ball, anim) {
      ctx.clearRect(0, 0, game._canvas.width, game._canvas.height);

      if (game.replayPlay && game.replayPlay.active) {
        drawReplayFrame(game, ctx, match, finalHUD, hudData);
        return;
      }

      game.camCtrl.beginWorldTransform();
      game.hud._drawField();

      if (game.animMgr) {
        game.animMgr.render(ctx, match, ball);
      } else {
        match.aiTeam.forEach(function (p) { game.hud._drawPlayer(p, false); });
        match.userTeam.forEach(function (p) { game.hud._drawPlayer(p, p === match.controlled); });
        game.hud._drawBall(ball.ball);
      }

      finalHUD.drawPowerInWorld(ctx, hudData.snapshot(match, ball, game.animMgr));
      game.camCtrl.endWorldTransform();

      hudData.update(match, ball);
      finalHUD.draw(ctx, hudData.snapshot(match, ball, game.animMgr));

      if (anim && anim.isGoalFlashing()) game.hud._drawGoalFlash(anim);
      if (match.finished) drawFinalSlate(ctx, match, game._canvas.width, game._canvas.height);
      else if (match.paused) drawPauseSlate(ctx, game._canvas.width, game._canvas.height);
    };
  }

  function drawReplayFrame(game, ctx, match, finalHUD, hudData) {
    var frame = game.replayPlay.tick();
    if (!frame) return;

    game.camCtrl.beginWorldTransform();
    game.hud._drawField();

    frame.a.concat(frame.u).forEach(function (fp) {
      var real = match.allPlayers().find(function (p) { return p.id === fp.id; });
      if (real) game.hud._drawPlayer({ x: fp.x, y: fp.y, team: real.team }, false);
    });
    game.hud._drawBall({ x: frame.bx, y: frame.by });

    game.camCtrl.endWorldTransform();

    var progress = game.replayPlay._cursor / Math.max(1, game.replayPlay._frames.length - 1);
    if (game.broadHUD) game.broadHUD.drawReplayOverlay(ctx, Math.min(progress, 1));

    finalHUD.draw(ctx, {
      score: frame.score,
      secondsLeft: 0,
      controlled: null,
      controlledName: null,
      stamina: 1,
      action: "replay",
      speed: 0,
      ballPos: { x: frame.bx, y: frame.by },
      ballSpeed: Math.hypot(frame.bvx, frame.bvy),
      userTeam: match.userTeam,
      aiTeam: match.aiTeam,
      stats: hudData.stats,
      powerCharge: 0,
      powerActive: false,
      powerType: "pass",
      lowerThirds: [{ text: "REPETICION", subtext: "Camara lenta 0.3x", timer: 90, maxTimer: 90, color: "#f0c040" }],
      cards: hudData.cards,
      substitutions: hudData.substitutions,
      maxSubs: hudData.maxSubs,
      finished: false,
      paused: false
    });
  }

  function patchReset(game, onReset) {
    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      onReset();
    };
  }

  function nearestTeammate(match, player) {
    var best = null;
    var bestD = Infinity;
    match.userTeam.forEach(function (p) {
      if (p === player) return;
      var d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    return best;
  }

  function notifyKick(game, player, action, power) {
    if (game.animMgr && game.animMgr.notifyAction) game.animMgr.notifyAction(player.id, action);
    if (game.animMgr && game.animMgr.notifyKick) game.animMgr.notifyKick(game.ball.ball.x, game.ball.ball.y, power);
  }

  function playerLabel(id) {
    var names = {
      u0: "Portero", u1: "Lat. Izq", u2: "Def. Central", u3: "Def. Central", u4: "Lat. Der",
      u5: "Volante Izq", u6: "Mediocentro", u7: "Volante Der",
      u8: "Extremo Izq", u9: "Delantero", u10: "Extremo Der"
    };
    return names[id] || String(id).toUpperCase();
  }

  function drawPauseSlate(ctx, w, h) {
    ctx.fillStyle = "rgba(7,11,18,0.46)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSA", w / 2, h / 2);
  }

  function drawFinalSlate(ctx, match, w, h) {
    ctx.fillStyle = "rgba(7,11,18,0.78)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 14px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PARTIDO TERMINADO", w / 2, h / 2 - 52);
    ctx.fillStyle = "#f0c040";
    ctx.font = "bold 54px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(match.score[0] + "  -  " + match.score[1], w / 2, h / 2 + 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px 'Segoe UI',Arial,sans-serif";
    ctx.fillText("AZUL vs ROJO", w / 2, h / 2 + 44);
  }
})();
