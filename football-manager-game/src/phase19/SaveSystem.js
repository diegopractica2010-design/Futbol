(function () {
  "use strict";

  // ============================================================
  // FASE 19 — SaveSystem.js
  // El "fake convincente":
  //   - Intercepta el balon antes de que cruce la linea de gol
  //   - Magnetismo: mueve suavemente al portero a la posicion correcta
  //   - Decide si atajar o error segun atributo del portero
  //   - Ejecuta saque corto o largo tras atajar
  // ============================================================

  window.FMG.Phase19 = window.FMG.Phase19 || {};

  var C = null;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase19-save") : 0.5; }

  var MAGNET_DIST    = 90;
  var MIN_SHOT_SPEED = 3.5;
  var SAVE_COOLDOWN  = 45;

  function SaveSystem() {
    this._cooldown = 0;
  }

  SaveSystem.prototype.tick = function () {
    if (this._cooldown > 0) this._cooldown--;
  };

  // Intentar atajar. Devuelve: true=atajado, false=error, null=no aplica
  SaveSystem.prototype.attempt = function (gkPlayer, ball, zone, attribute) {
    if (!C) C = window.FMG.Phase16.C;

    var b         = ball.ball;
    var ballSpeed = Math.hypot(b.vx, b.vy);
    var ballDist  = ball.distTo(gkPlayer);

    if (ballSpeed < MIN_SHOT_SPEED) return null;
    if (this._cooldown > 0)         return null;
    if (ballDist > MAGNET_DIST)     return null;

    // Verificar que el balon va hacia el arco
    var toGoalX = gkPlayer.x - b.x;
    if (b.vx * toGoalX <= 0) return null;

    var zoneDiff = _zoneDifficulty(zone);
    var saveProb = Math.max(0.08, Math.min(0.96, attribute * (1 - zoneDiff * 0.35)));
    var saved    = rng() < saveProb;

    this._cooldown = SAVE_COOLDOWN;

    if (saved) this._executeSave(gkPlayer, ball, zone);

    return saved;
  };

  SaveSystem.prototype._executeSave = function (gkPlayer, ball, zone) {
    if (!C) C = window.FMG.Phase16.C;
    var b       = ball.ball;
    var savePos = _zonePosition(gkPlayer, zone);

    // Magnetismo suave del portero
    gkPlayer.x = gkPlayer.x * 0.3 + savePos.x * 0.7;
    gkPlayer.y = gkPlayer.y * 0.3 + savePos.y * 0.7;

    // Balon a las manos del portero
    b.x  = gkPlayer.x + (b.x > gkPlayer.x ? 1 : -1) * 14;
    b.y  = gkPlayer.y + (b.y > gkPlayer.y ? 1 : -1) * 8;
    b.vx = 0;
    b.vy = 0;
  };

  SaveSystem.prototype.shortThrow = function (gkPlayer, ball, teammates) {
    if (!C) C = window.FMG.Phase16.C;
    var b    = ball.ball;
    var best = null, bestD = Infinity;

    teammates.forEach(function (tm) {
      if (tm === gkPlayer) return;
      var d = Math.hypot(tm.x - gkPlayer.x, tm.y - gkPlayer.y);
      if (d < bestD) { bestD = d; best = tm; }
    });

    if (!best) return;
    var dx  = best.x - b.x;
    var dy  = best.y - b.y;
    var len = Math.hypot(dx, dy) || 1;
    ball.applyImpulse(
      (dx / len + (rng() - 0.5) * 0.15) * C.PASS_POWER * 0.85,
      (dy / len + (rng() - 0.5) * 0.15) * C.PASS_POWER * 0.85
    );
  };

  SaveSystem.prototype.punt = function (gkPlayer, ball, attackingRight) {
    if (!C) C = window.FMG.Phase16.C;
    var b       = ball.ball;
    var targetX = attackingRight ? C.FIELD_W * 0.65 : C.FIELD_W * 0.35;
    var targetY = C.FIELD_H / 2 + (rng() - 0.5) * 120;
    var dx      = targetX - b.x;
    var dy      = targetY - b.y;
    var len     = Math.hypot(dx, dy) || 1;
    ball.applyImpulse(
      (dx / len) * C.SHOOT_POWER * 0.75,
      (dy / len) * C.SHOOT_POWER * 0.75
    );
  };

  function _zoneDifficulty(zone) {
    return { center: 0.0, "dive-left": 0.45, "dive-right": 0.45, "high-left": 0.65, "high-right": 0.65 }[zone] || 0.3;
  }

  function _zonePosition(gkPlayer, zone) {
    var off = { center: [0,0], "dive-left": [4,-22], "dive-right": [4,22], "high-left": [2,-18], "high-right": [2,18] }[zone] || [0,0];
    return { x: gkPlayer.x + off[0], y: gkPlayer.y + off[1] };
  }

  window.FMG.Phase19.SaveSystem = SaveSystem;
})();
