(function () {
  "use strict";

  // ============================================================
  // FASE 18 — MovementSystem.js
  // Ejecuta la Decision: mueve al jugador hacia su target.
  // Aplica LOD: jugadores lejos del balon actualizan menos.
  // No toma decisiones. Solo mueve.
  // ============================================================

  window.FMG.Phase18 = window.FMG.Phase18 || {};

  var C      = null;
  var ACTION = null;

  // Multiplicadores de velocidad por accion
  var SPEED_MULT = {
    hold:    0.55,
    press:   1.00,
    mark:    0.85,
    support: 0.75,
    dribble: 0.80,
    shoot:   0.00,  // el tiro lo maneja TeamBrain, no el movimiento
    pass:    0.00,  // idem
    clear:   0.90,
    space:   0.85
  };

  // LOD: distancia al balon -> intervalo de actualizacion en ticks
  var LOD_NEAR   = 150;  // < 150px: actualiza cada tick
  var LOD_MID    = 300;  // 150-300px: cada 4 ticks
  var LOD_FAR    = 999;  // > 300px: cada 8 ticks

  function MovementSystem() {
    this._tickCounters = {}; // playerId -> ticks desde ultima actualizacion
  }

  // Mover un jugador segun su decision
  // Devuelve true si se ejecuto movimiento este tick
  MovementSystem.prototype.execute = function (player, decision, ballDist, tickCount, match) {
    if (!C)      C      = window.FMG.Phase16.C;
    if (!ACTION) ACTION = window.FMG.Phase18.ACTION;

    var id = player.id;

    // LOD: calcular intervalo
    var interval = ballDist < LOD_NEAR ? 1 :
                   ballDist < LOD_MID  ? 4 : 8;

    // Inicializar contador
    if (this._tickCounters[id] === undefined) this._tickCounters[id] = 0;
    this._tickCounters[id]++;

    if (this._tickCounters[id] % interval !== 0) return false;

    // Tiro y pase: no mover (TeamBrain aplica impulso)
    if (decision.action === ACTION.SHOOT || decision.action === ACTION.PASS) return false;

    var dx = decision.targetX - player.x;
    var dy = decision.targetY - player.y;
    var dist = Math.hypot(dx, dy);

    // No moverse si ya esta en el target (evita vibración)
    if (dist < 4) return false;

    var mult  = (SPEED_MULT[decision.action] || 0.7) * decision.speed;
    var speed = C.AI_SPEED * mult;

    match.movePlayer(player, dx / dist, dy / dist, speed);
    return true;
  };

  MovementSystem.prototype.reset = function () {
    this._tickCounters = {};
  };

  window.FMG.Phase18.MovementSystem = MovementSystem;
})();
