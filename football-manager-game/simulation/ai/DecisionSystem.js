(function () {
  "use strict";

  // ============================================================
  // FASE 18 — DecisionSystem.js
  // Arbol de decision por jugador.
  // Entrada: contexto del jugador  ->  Salida: Decision
  // Decision = { action, targetX, targetY, speed }
  // Acciones: HOLD | PRESS | MARK | SUPPORT | DRIBBLE | SHOOT | PASS | CLEAR
  // Puro. Sin estado. El MovementSystem ejecuta la decision.
  // ============================================================

  window.FMG.Phase18 = window.FMG.Phase18 || {};

  var C = null;

  var ACTION = {
    HOLD:    "hold",     // mantener posicion base
    PRESS:   "press",    // presionar al poseedor del balon
    MARK:    "mark",     // marcar rival cercano
    SUPPORT: "support",  // apoyar al poseedor del balon (triangulo)
    DRIBBLE: "dribble",  // avanzar con el balon
    SHOOT:   "shoot",    // tirar al arco
    PASS:    "pass",     // pasar a companero libre
    CLEAR:   "clear",    // despejar (portero o defensa bajo presion)
    SPACE:   "space"     // buscar espacio (desmarque)
  };

  function DecisionSystem() {}

  // Contexto esperado:
  // {
  //   player, playerIndex, role, team,
  //   ball, hasBall, ballDist,
  //   basePos,           // posicion base de formacion
  //   rivals,            // array de jugadores rivales
  //   teammates,         // array de companeros
  //   attackingRight,    // bool
  //   phase              // "attacking"|"defending"|"neutral"
  // }
  DecisionSystem.prototype.decide = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;

    var p    = ctx.player;
    var role = ctx.role;
    var ball = ctx.ball;

    // ---- PORTERO ----
    if (role.name === "goalkeeper") {
      return this._decideGoalkeeper(ctx);
    }

    // ---- POSEEDOR DEL BALON ----
    if (ctx.hasBall) {
      return this._decidePossessor(ctx);
    }

    // ---- SIN BALON ----
    return this._decideOffBall(ctx);
  };

  DecisionSystem.prototype._decideGoalkeeper = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var ball = ctx.ball;
    var p    = ctx.player;

    // Si el balon esta muy cerca, despejar
    if (ctx.ballDist < 50) {
      var clearX = ctx.attackingRight ? C.FIELD_W * 0.5 : C.FIELD_W * 0.5;
      return { action: ACTION.CLEAR, targetX: clearX, targetY: C.FIELD_H / 2, speed: 1.0 };
    }

    // Posicion: entre el arco y el balon, pegado a la linea
    var gkX = ctx.attackingRight ? C.PLAYER_R + 30 : C.FIELD_W - C.PLAYER_R - 30;
    var gkY = C.FIELD_H / 2 + (ball.y - C.FIELD_H / 2) * 0.55;
    gkY = Math.max(C.FIELD_H * 0.2, Math.min(C.FIELD_H * 0.8, gkY));

    return { action: ACTION.HOLD, targetX: gkX, targetY: gkY, speed: 0.7 };
  };

  DecisionSystem.prototype._decidePossessor = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var p    = ctx.player;
    var ball = ctx.ball;
    var role = ctx.role;

    var goalX = ctx.attackingRight ? C.FIELD_W - C.GOAL_W : C.GOAL_W;
    var goalY = C.FIELD_H / 2;
    var distToGoal = Math.hypot(p.x - goalX, p.y - goalY);

    // Tiro si esta en rango y con angulo razonable
    if (distToGoal < role.shootDist) {
      return { action: ACTION.SHOOT, targetX: goalX, targetY: goalY, speed: 1.0 };
    }

    // Buscar companero libre para pasar
    var passTarget = this._findPassTarget(ctx);
    if (passTarget) {
      return { action: ACTION.PASS, targetX: passTarget.x, targetY: passTarget.y, speed: 1.0 };
    }

    // Avanzar con el balon hacia el arco
    return { action: ACTION.DRIBBLE, targetX: goalX, targetY: goalY + (p.y - goalY) * 0.3, speed: 0.85 };
  };

  DecisionSystem.prototype._decideOffBall = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var p    = ctx.player;
    var role = ctx.role;
    var ball = ctx.ball;

    // Presionar si el rival tiene el balon y estamos cerca
    if (!ctx.teamHasBall && ctx.ballDist < role.pressRadius) {
      return { action: ACTION.PRESS, targetX: ball.x, targetY: ball.y, speed: Math.min(1.25, 0.85 + role.aggression * 0.3) };
    }

    if (ctx.teamHasBall && shouldAttackSpace(ctx)) {
      var runPos = this._findSpace(ctx);
      var runDepth = (ctx.player._riskModifier || 1) * 34;
      runPos.x += ctx.attackingRight ? runDepth : -runDepth;
      runPos.x = Math.max(C.PLAYER_R, Math.min(C.FIELD_W - C.PLAYER_R, runPos.x));
      return { action: ACTION.SPACE, targetX: runPos.x, targetY: runPos.y, speed: 0.95 };
    }

    // Marcar rival cercano si estamos defendiendo
    if (ctx.phase === "defending" || ctx.phase === "neutral") {
      var markTarget = this._findMarkTarget(ctx);
      if (markTarget) {
        // Posicion entre el rival y el arco propio (interceptar linea de pase)
        var ownGoalX = ctx.attackingRight ? 0 : C.FIELD_W;
        var mx = markTarget.x * 0.55 + ownGoalX * 0.45;
        var my = markTarget.y * 0.7 + p.y * 0.3;
        return { action: ACTION.MARK, targetX: mx, targetY: my, speed: 0.9 };
      }
    }

    // Apoyar al poseedor (triangulo de apoyo)
    if (ctx.teamHasBall) {
      var supportPos = this._findSupportPosition(ctx);
      if (ctx.player._instruction === "stayBack" || ctx.player._tacticRole === "defensive") {
        supportPos.x = supportPos.x * 0.45 + ctx.basePos.x * 0.55;
        supportPos.y = supportPos.y * 0.45 + ctx.basePos.y * 0.55;
      }
      return { action: ACTION.SUPPORT, targetX: supportPos.x, targetY: supportPos.y, speed: 0.8 };
    }

    // Desmarque ofensivo: buscar espacio entre rivales
    if (ctx.phase === "attacking") {
      var spacePos = this._findSpace(ctx);
      return { action: ACTION.SPACE, targetX: spacePos.x, targetY: spacePos.y, speed: 0.9 };
    }

    // Default: mantener posicion base de formacion
    return { action: ACTION.HOLD, targetX: ctx.basePos.x, targetY: ctx.basePos.y, speed: 0.6 };
  };

  // Buscar companero libre (sin rival cercano) para pasar
  DecisionSystem.prototype._findPassTarget = function (ctx) {
    var best = null, bestScore = -Infinity;
    var ball = ctx.ball;
    var goalX = ctx.attackingRight ? C.FIELD_W : 0;

    ctx.teammates.forEach(function (tm) {
      if (tm === ctx.player) return;
      // Verificar que no haya rival bloqueando la linea de pase
      var blocked = ctx.rivals.some(function (r) {
        return _linePointDist(ball.x, ball.y, tm.x, tm.y, r.x, r.y) < 28;
      });
      if (blocked) return;

      // Score: mas adelantado hacia el arco = mejor
      var advanceScore = ctx.attackingRight ? tm.x : C.FIELD_W - tm.x;
      var distScore    = -Math.hypot(tm.x - ball.x, tm.y - ball.y) * 0.01;
      var controlScore = (tm._controlAccuracy || 0.7) * 60;
      var risk = ctx.player._riskModifier || 1;
      var score = advanceScore * risk + distScore + controlScore;
      if (score > bestScore) { bestScore = score; best = tm; }
    });
    return best;
  };

  // Buscar rival cercano para marcar
  DecisionSystem.prototype._findMarkTarget = function (ctx) {
    var best = null, bestD = Infinity;
    var role = ctx.role;
    ctx.rivals.forEach(function (r) {
      var d = Math.hypot(r.x - ctx.player.x, r.y - ctx.player.y);
      if (d < role.markRadius && d < bestD) { bestD = d; best = r; }
    });
    return best;
  };

  // Posicion de apoyo: triangulo lateral al poseedor
  DecisionSystem.prototype._findSupportPosition = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var ball = ctx.ball;
    var idx  = ctx.playerIndex;
    // Offset lateral alternado por indice
    var lateralOffset = (idx % 2 === 0 ? -1 : 1) * 70;
    var depthOffset   = ctx.attackingRight ? -60 : 60;

    return {
      x: Math.max(C.PLAYER_R, Math.min(C.FIELD_W - C.PLAYER_R, ball.x + depthOffset)),
      y: Math.max(C.PLAYER_R, Math.min(C.FIELD_H - C.PLAYER_R, ball.y + lateralOffset))
    };
  };

  // Buscar espacio: alejarse de rivales cercanos
  DecisionSystem.prototype._findSpace = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var p   = ctx.player;
    var base = ctx.basePos;

    // Calcular vector de repulsion de rivales cercanos
    var rx = 0, ry = 0;
    ctx.rivals.forEach(function (r) {
      var dx = p.x - r.x;
      var dy = p.y - r.y;
      var d  = Math.hypot(dx, dy) || 1;
      if (d < 100) {
        rx += (dx / d) * (100 - d) * 0.5;
        ry += (dy / d) * (100 - d) * 0.5;
      }
    });

    return {
      x: Math.max(C.PLAYER_R, Math.min(C.FIELD_W - C.PLAYER_R, base.x + rx)),
      y: Math.max(C.PLAYER_R, Math.min(C.FIELD_H - C.PLAYER_R, base.y + ry))
    };
  };

  // Distancia de un punto a un segmento (para detectar lineas de pase bloqueadas)
  function _linePointDist(ax, ay, bx, by, px, py) {
    var abx = bx - ax, aby = by - ay;
    var len2 = abx * abx + aby * aby;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    var t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
    return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
  }

  function shouldAttackSpace(ctx) {
    if (ctx.player._instruction === "stayBack") return false;
    if (ctx.player._instruction === "takeRisks") return true;
    if (ctx.player._tacticRole === "attacking") return ctx.phase === "attacking" || ctx.ballDist < 260;
    return ctx.phase === "attacking" && (ctx.player._riskModifier || 1) > 1.12;
  }

  DecisionSystem.ACTION = ACTION;
  window.FMG.Phase18.DecisionSystem = DecisionSystem;
  window.FMG.Phase18.ACTION = ACTION;
})();
